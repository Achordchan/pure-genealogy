"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createClient } from "@/lib/supabase/server";
import {
  buildInternalAccountEmail,
  getInitialAdminHashes,
  type AccountProfile,
  validateIdCard,
  validateRealName,
} from "@/lib/account/shared";
import {
  buildLoginCredentials,
  createProfileInsertPayload,
  findAccountProfileForLogin,
  getAccountRedirectPath,
  getCurrentAccountProfile,
  listPendingAccounts,
  requireAdminAccount,
  requireSignedInAccount,
} from "@/lib/account/server";

export interface AuthFormState {
  error: string | null;
}

function getFieldValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function validateIdentityForm(realName: string, idCard: string) {
  const realNameError = validateRealName(realName);
  if (realNameError) {
    return realNameError;
  }

  const idCardError = validateIdCard(idCard);
  if (idCardError) {
    return idCardError;
  }

  return null;
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
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      error: error instanceof Error ? error.message : "登录失败，请稍后重试",
    };
  }
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

    const payload = createProfileInsertPayload({
      authUserId: "",
      realName,
      idCard,
      isAdmin: false,
      status: "pending",
    });

    const existingProfile = await findProfileByHash(payload.id_card_hash);
    if (existingProfile) {
      return { error: "该身份已存在，请直接登录" };
    }

    const supabase = await createClient();
    const internalEmail = buildInternalAccountEmail(payload.id_card_hash);
    const normalizedPassword = buildLoginCredentials(
      { id_card_hash: payload.id_card_hash },
      idCard,
    ).password;

    let authUserId: string | null = null;
    let signUpErrorMessage: string | null = null;

    const signUpResult = await supabase.auth.signUp({
      email: internalEmail,
      password: normalizedPassword,
    });

    authUserId = signUpResult.data.user?.id ?? null;
    signUpErrorMessage = signUpResult.error?.message ?? null;

    if (!authUserId && signUpErrorMessage) {
      const retryLogin = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: normalizedPassword,
      });

      authUserId = retryLogin.data.user?.id ?? null;
      if (!authUserId) {
        return { error: "该身份已存在，请直接登录" };
      }
    }

    if (!authUserId) {
      return { error: "注册失败，请稍后重试" };
    }

    const isAdmin = getInitialAdminHashes().has(payload.id_card_hash);
    const profilePayload = createProfileInsertPayload({
      authUserId,
      realName,
      idCard,
      isAdmin,
      status: isAdmin ? "approved" : "pending",
    });

    const { error: insertError } = await supabase
      .from("account_profiles")
      .insert(profilePayload);

    if (insertError && !insertError.message.includes("duplicate")) {
      return { error: "账号已创建，但资料写入失败，请联系管理员处理" };
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password: normalizedPassword,
    });

    if (loginError) {
      return { error: "注册成功，但自动登录失败，请返回登录页重新登录" };
    }

    revalidatePath("/", "layout");
    redirect(getAccountRedirectPath({ is_admin: isAdmin, status: isAdmin ? "approved" : "pending" }));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      error: error instanceof Error ? error.message : "注册失败，请稍后重试",
    };
  }
}

export async function updatePendingPhoneAction(formData: FormData) {
  const phone = getFieldValue(formData, "phone").trim();

  if (!/^1\d{10}$/.test(phone)) {
    redirect("/auth/pending?error=请输入正确的11位手机号");
  }

  const { supabase, profile } = await requireSignedInAccount();
  const { error } = await supabase
    .from("account_profiles")
    .update({
      phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) {
    redirect(`/auth/pending?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/auth/pending");
  redirect(`/auth/pending?success=${encodeURIComponent("手机号已保存")}`);
}

async function updateAccountStatus(accountId: string, status: "approved" | "rejected") {
  const { supabase, user } = await requireAdminAccount();
  const { error } = await supabase
    .from("account_profiles")
    .update({
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by: status === "approved" ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) {
    redirect(`/admin/accounts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/accounts");
  revalidatePath("/", "layout");
}

export async function approveAccountAction(formData: FormData) {
  const accountId = getFieldValue(formData, "accountId");
  await updateAccountStatus(accountId, "approved");
  redirect(`/admin/accounts?success=${encodeURIComponent("账号已批准")}`);
}

export async function rejectAccountAction(formData: FormData) {
  const accountId = getFieldValue(formData, "accountId");
  await updateAccountStatus(accountId, "rejected");
  redirect(`/admin/accounts?success=${encodeURIComponent("账号已拒绝")}`);
}

export async function getPendingAccountsForAdmin() {
  await requireAdminAccount();
  return listPendingAccounts();
}

export async function getCurrentPendingProfile() {
  return getCurrentAccountProfile();
}
