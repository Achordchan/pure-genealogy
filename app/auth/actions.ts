"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentAccountProfile,
  listFamilyMemberOptions,
  listPendingAccounts,
  requireAdminAccount,
  requireSignedInAccount,
  buildLoginCredentials,
  createProfileInsertPayload,
  findAccountProfileByHashForAdmin,
  findAccountProfileForLoginByAdmin,
  findInternalAuthUserByEmailForAdmin,
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
import {
  clearPendingPhoneDraft,
  setFlashMessage,
  setPendingPhoneDraft,
} from "@/lib/flash";

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

function getExistingAccountMessage(profile: Pick<AccountProfile, "status">) {
  if (profile.status === "pending") {
    return "账号正在审核，请直接登录查看状态";
  }

  return "该身份已存在，请直接登录";
}

async function signInWithIdentityCredentials(idCardHash: string, idCard: string) {
  const supabase = await createClient();
  const credentials = buildLoginCredentials({ id_card_hash: idCardHash }, idCard);

  const { error } = await supabase.auth.signInWithPassword(credentials);

  return {
    supabase,
    error,
  };
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

    const profile = await findAccountProfileForLoginByAdmin(realName, idCard);
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

    const initialAdminHashes = getInitialAdminHashes();
    const initialPayload = createProfileInsertPayload({
      authUserId: "",
      realName,
      idCard,
      role: "member",
      status: "pending",
    });
    const idCardHash = initialPayload.id_card_hash;
    const internalEmail = buildInternalAccountEmail(idCardHash);
    const normalizedPassword = buildLoginCredentials(
      { id_card_hash: idCardHash },
      idCard,
    ).password;
    const isInitialAdmin = initialAdminHashes.has(idCardHash);

    const existingProfile = await findAccountProfileByHashForAdmin(idCardHash);
    if (existingProfile) {
      if (existingProfile.status === "pending") {
        const { error: loginError } = await signInWithIdentityCredentials(idCardHash, idCard);

        if (!loginError) {
          redirect("/auth/pending");
        }
      }

      return { error: getExistingAccountMessage(existingProfile) };
    }

    const existingAuthUser = await findInternalAuthUserByEmailForAdmin(internalEmail);
    const adminClient = createAdminClient();

    let authUserId = existingAuthUser?.id ?? "";
    let createdAuthUserId: string | null = null;

    if (existingAuthUser) {
      const { error: updateUserError } = await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
        email: internalEmail,
        password: normalizedPassword,
        email_confirm: true,
        user_metadata: {
          real_name: realName.trim(),
        },
      });

      if (updateUserError) {
        return { error: "注册失败，请稍后重试" };
      }
    } else {
      const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
        email: internalEmail,
        password: normalizedPassword,
        email_confirm: true,
        user_metadata: {
          real_name: realName.trim(),
        },
      });

      if (createUserError || !createdUser.user) {
        return { error: "注册失败，请稍后重试" };
      }

      authUserId = createdUser.user.id;
      createdAuthUserId = createdUser.user.id;
    }

    const profilePayload = createProfileInsertPayload({
      authUserId,
      realName,
      idCard,
      role: isInitialAdmin ? "admin" : "member",
      status: isInitialAdmin ? "approved" : "pending",
    });

    const { error: insertError } = await adminClient.from("account_profiles").insert(profilePayload);

    if (insertError) {
      if (createdAuthUserId) {
        await adminClient.auth.admin.deleteUser(createdAuthUserId);
      }

      if (insertError.message.includes("duplicate")) {
        const repairedProfile = await findAccountProfileByHashForAdmin(idCardHash);
        if (repairedProfile) {
          return { error: getExistingAccountMessage(repairedProfile) };
        }
      }

      return { error: "账号已创建，但资料写入失败，请联系管理员处理" };
    }

    const { error: loginError } = await signInWithIdentityCredentials(idCardHash, idCard);

    if (loginError) {
      return { error: "注册成功，但自动登录失败，请返回登录页重新登录" };
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
    await setPendingPhoneDraft(phone);
    await setFlashMessage({ type: "error", message: "请输入正确的11位手机号" });
    redirect("/auth/pending");
  }

  const { supabase, profile } = await requireSignedInAccount();
  const { error } = await supabase
    .from("account_profiles")
    .update({ phone, updated_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (error) {
    await setPendingPhoneDraft(phone);
    await setFlashMessage({ type: "error", message: error.message });
    redirect("/auth/pending");
  }

  revalidatePath("/auth/pending");
  await clearPendingPhoneDraft();
  await setFlashMessage({ type: "success", message: "手机号已保存" });
  redirect("/auth/pending");
}

async function updatePendingAccountStatus(formData: FormData, status: "approved" | "rejected") {
  const { supabase } = await requireAdminAccount();
  const accountId = getFieldValue(formData, "accountId");
  const role = normalizeAccountRole(getFieldValue(formData, "role"));
  const memberIdRaw = getFieldValue(formData, "memberId");
  const memberId = memberIdRaw ? Number(memberIdRaw) : null;

  if (!accountId) {
    await setFlashMessage({ type: "error", message: "缺少账号标识" });
    redirect("/admin/accounts");
  }

  if (status === "approved") {
    if (!role || role === "admin") {
      await setFlashMessage({ type: "error", message: "待审核账号只能批准为成员或编辑员" });
      redirect("/admin/accounts");
    }

    if (!memberId) {
      await setFlashMessage({ type: "error", message: "批准账号前必须绑定成员" });
      redirect("/admin/accounts");
    }
  }

  const rpcName = status === "approved" ? "app_approve_account" : "app_reject_account";
  const rpcParams =
    status === "approved"
      ? {
          target_profile_id: accountId,
          target_member_id: memberId,
          target_role: role,
        }
      : {
          target_profile_id: accountId,
          review_comment: "",
        };

  const { error } = await supabase.rpc(rpcName, rpcParams);

  if (error) {
    await setFlashMessage({ type: "error", message: error.message });
    redirect("/admin/accounts");
  }

  revalidatePath("/admin/accounts");
  revalidatePath("/auth/pending");
  revalidatePath("/", "layout");
}

export async function approveAccountAction(formData: FormData) {
  await updatePendingAccountStatus(formData, "approved");
  await setFlashMessage({ type: "success", message: "账号已批准" });
  redirect("/admin/accounts");
}

export async function rejectAccountAction(formData: FormData) {
  await updatePendingAccountStatus(formData, "rejected");
  await setFlashMessage({ type: "success", message: "账号已拒绝" });
  redirect("/admin/accounts");
}

export async function getPendingAccountsForAdmin() {
  await requireAdminAccount();
  return listPendingAccounts();
}

export async function getMemberOptionsForAdmin() {
  await requireAdminAccount();
  return listFamilyMemberOptions();
}

export async function getCurrentPendingProfile() {
  return getCurrentAccountProfile();
}
