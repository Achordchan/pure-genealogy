"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  fetchApiMemberOptionsForAdmin,
  fetchApiPendingAccounts,
  signUpApiAccount,
  updateApiPendingAccount,
  updateApiProfilePhone,
} from "@/lib/api/account";
import { apiFetch } from "@/lib/api/server";
import {
  getAccountRedirectPath,
  getCurrentAccountProfile,
  requireAdminAccount,
  requireSignedInAccount,
} from "@/lib/account/server";
import {
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

    const response = await apiFetch<{ profile: AccountProfile }>("/api/auth/login", {
      method: "POST",
      body: { realName, idCard },
    });
    redirect(getAccountRedirectPath(response.profile));
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

    const response = await signUpApiAccount({ realName, idCard });
    revalidatePath("/", "layout");
    redirect(getAccountRedirectPath(response.profile));
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

  try {
    await requireSignedInAccount();
    await updateApiProfilePhone(phone);
    await clearPendingPhoneDraft();
    await setFlashMessage({ type: "success", message: "手机号已更新" });
  } catch (error) {
    await setPendingPhoneDraft(phone);
    await setFlashMessage({ type: "error", message: error instanceof Error ? error.message : "更新失败" });
  }

  revalidatePath("/auth/pending");
  redirect("/auth/pending");
}

async function updatePendingAccountStatus(formData: FormData, status: "approved" | "rejected") {
  await requireAdminAccount();
  const accountId = getFieldValue(formData, "accountId");
  const role = normalizeAccountRole(getFieldValue(formData, "role")) ?? "member";
  const memberIdValue = getFieldValue(formData, "memberId");
  const memberId = memberIdValue ? Number(memberIdValue) : null;

  if (!accountId) {
    await setFlashMessage({ type: "error", message: "缺少账号标识" });
    redirect("/admin/accounts");
  }

  try {
    await updateApiPendingAccount({ accountId, status, role, memberId });
  } catch (error) {
    await setFlashMessage({ type: "error", message: error instanceof Error ? error.message : "处理账号失败" });
    redirect("/admin/accounts");
  }

  revalidatePath("/admin/accounts");
  revalidatePath("/", "layout");
}

export async function approveAccountAction(formData: FormData) {
  await updatePendingAccountStatus(formData, "approved");
  await setFlashMessage({ type: "success", message: "账号已通过审核" });
  redirect("/admin/accounts");
}

export async function rejectAccountAction(formData: FormData) {
  await updatePendingAccountStatus(formData, "rejected");
  await setFlashMessage({ type: "success", message: "账号已驳回" });
  redirect("/admin/accounts");
}

export async function getPendingAccountsForAdmin() {
  await requireAdminAccount();
  return fetchApiPendingAccounts();
}

export async function getMemberOptionsForAdmin() {
  await requireAdminAccount();
  return fetchApiMemberOptionsForAdmin();
}

export async function getCurrentPendingProfile() {
  return getCurrentAccountProfile();
}
