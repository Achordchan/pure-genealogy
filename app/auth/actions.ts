"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentAccountProfile,
  listApprovedAccounts,
  listFamilyMemberOptions,
  listPendingAccounts,
  requireAdminAccount,
  requireSignedInAccount,
  buildLoginCredentials,
  createProfileInsertPayload,
  findAccountProfileForLogin,
  getAccountRedirectPath,
} from "@/lib/account/server";
import {
  buildInternalAccountEmail,
  getInitialAdminHashes,
  normalizeAccountRole,
  type AccountProfile,
  validateIdCard,
  validateRealName,
} from "@/lib/account/shared";

export interface AuthFormState {
  error: string | null;
}

function getFieldValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function validateIdentityForm(realName: string, idCard: string) {
  const realNameError = validateRealName(realName);
  if (realNameError) return realNameError;

  const idCardError = validateIdCard(idCard);
  if (idCardError) return idCardError;

  return null;
}

async function findProfileByHash(idCardHash: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_profiles")
    .select("*")
    .eq("id_card_hash", idCardHash)
    .maybeSingle<AccountProfile>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function loginWithIdentityAction(
  _: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    const realName = getFieldValue(formData, "realName");
    const idCard = getFieldValue(formData, "idCard");
    const validationError = validateIdentityForm(realName, idCard);

    if (validationError) {
      return { error: validationError };
    }

    const profile = await findAccountProfileForLogin(realName, idCard);
    if (!profile) {
      return { error: "姓名或身份证号不正确" };
    }

    const supabase = await createClient();
    const { email, password } = buildLoginCredentials(profile, idCard);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: "姓名或身份证号不正确" };
    }

    redirect(getAccountRedirectPath(profile));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "登录失败，请稍后重试" };
  }
}

export async function signUpWithIdentityAction(
  _: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    const realName = getFieldValue(formData, "realName");
    const idCard = getFieldValue(formData, "idCard");
    const validationError = validateIdentityForm(realName, idCard);

    if (validationError) {
      return { error: validationError };
    }

    const initialPayload = createProfileInsertPayload({
      authUserId: "",
      realName,
      idCard,
      role: "member",
      status: "pending",
    });

    const existingProfile = await findProfileByHash(initialPayload.id_card_hash);
    if (existingProfile) {
      return { error: "该身份已存在，请直接登录" };
    }

    const supabase = await createClient();
    const internalEmail = buildInternalAccountEmail(initialPayload.id_card_hash);
    const normalizedPassword = buildLoginCredentials(
      { id_card_hash: initialPayload.id_card_hash },
      idCard,
    ).password;

    let authUserId = "";
    const signUpResult = await supabase.auth.signUp({
      email: internalEmail,
      password: normalizedPassword,
    });

    authUserId = signUpResult.data.user?.id ?? "";

    if (!authUserId && signUpResult.error) {
      const retryLogin = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: normalizedPassword,
      });
      authUserId = retryLogin.data.user?.id ?? "";

      if (!authUserId) {
        return { error: "该身份已存在，请直接登录" };
      }
    }

    if (!authUserId) {
      return { error: "注册失败，请稍后重试" };
    }

    const isInitialAdmin = getInitialAdminHashes().has(initialPayload.id_card_hash);
    const profilePayload = createProfileInsertPayload({
      authUserId,
      realName,
      idCard,
      role: isInitialAdmin ? "admin" : "member",
      status: isInitialAdmin ? "approved" : "pending",
    });

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password: normalizedPassword,
    });

    if (loginError) {
      return { error: "注册成功，但自动登录失败，请返回登录页重新登录" };
    }

    const { error: insertError } = await supabase.from("account_profiles").insert(profilePayload);

    if (insertError && !insertError.message.includes("duplicate")) {
      return { error: "账号已创建，但资料写入失败，请联系管理员处理" };
    }

    revalidatePath("/", "layout");
    redirect(getAccountRedirectPath(profilePayload));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: error instanceof Error ? error.message : "注册失败，请稍后重试" };
  }
}

export async function updatePendingPhoneAction(formData: FormData) {
  const phone = getFieldValue(formData, "phone").trim();

  if (!/^1\d{10}$/.test(phone)) {
    redirect(`/auth/pending?error=${encodeURIComponent("请输入正确的11位手机号")}`);
  }

  const { supabase, profile } = await requireSignedInAccount();
  const { error } = await supabase
    .from("account_profiles")
    .update({ phone, updated_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (error) {
    redirect(`/auth/pending?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/auth/pending");
  redirect(`/auth/pending?success=${encodeURIComponent("手机号已保存")}`);
}

async function updatePendingAccountStatus(formData: FormData, status: "approved" | "rejected") {
  const { supabase, user } = await requireAdminAccount();
  const accountId = getFieldValue(formData, "accountId");
  const role = normalizeAccountRole(getFieldValue(formData, "role"));
  const memberIdRaw = getFieldValue(formData, "memberId");
  const memberId = memberIdRaw ? Number(memberIdRaw) : null;

  if (!accountId) {
    redirect(`/admin/accounts?error=${encodeURIComponent("缺少账号标识")}`);
  }

  if (status === "approved") {
    if (!role || role === "admin") {
      redirect(`/admin/accounts?error=${encodeURIComponent("待审核账号只能批准为成员或编辑员")}`);
    }

    if (!memberId) {
      redirect(`/admin/accounts?error=${encodeURIComponent("批准账号前必须绑定成员")}`);
    }
  }

  const updates = {
    status,
    role: status === "approved" ? role : "member",
    member_id: status === "approved" ? memberId : null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    approved_by: status === "approved" ? user.id : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("account_profiles").update(updates).eq("id", accountId);

  if (error) {
    redirect(`/admin/accounts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/accounts");
  revalidatePath("/admin/accounts/manage");
  revalidatePath("/", "layout");
}

export async function approveAccountAction(formData: FormData) {
  await updatePendingAccountStatus(formData, "approved");
  redirect(`/admin/accounts?success=${encodeURIComponent("账号已批准")}`);
}

export async function rejectAccountAction(formData: FormData) {
  await updatePendingAccountStatus(formData, "rejected");
  redirect(`/admin/accounts?success=${encodeURIComponent("账号已拒绝")}`);
}

export async function updateApprovedAccountAction(formData: FormData) {
  const { supabase } = await requireAdminAccount();
  const accountId = getFieldValue(formData, "accountId");
  const role = normalizeAccountRole(getFieldValue(formData, "role"));
  const memberIdRaw = getFieldValue(formData, "memberId");
  const memberId = memberIdRaw ? Number(memberIdRaw) : null;

  if (!accountId || !role) {
    redirect(`/admin/accounts/manage?error=${encodeURIComponent("账号参数不完整")}`);
  }

  if (role !== "admin" && !memberId) {
    redirect(`/admin/accounts/manage?error=${encodeURIComponent("成员或编辑员必须绑定族谱成员")}`);
  }

  const { error } = await supabase
    .from("account_profiles")
    .update({
      role,
      member_id: role === "admin" ? null : memberId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) {
    redirect(`/admin/accounts/manage?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/accounts/manage");
  revalidatePath("/", "layout");
  redirect(`/admin/accounts/manage?success=${encodeURIComponent("账号信息已更新")}`);
}

export async function getPendingAccountsForAdmin() {
  await requireAdminAccount();
  return listPendingAccounts();
}

export async function getApprovedAccountsForAdmin() {
  await requireAdminAccount();
  return listApprovedAccounts();
}

export async function getMemberOptionsForAdmin() {
  await requireAdminAccount();
  return listFamilyMemberOptions();
}

export async function getCurrentPendingProfile() {
  return getCurrentAccountProfile();
}
