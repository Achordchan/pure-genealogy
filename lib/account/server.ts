import "server-only";

import {
  fetchApiBackofficeNoticeCounts,
  fetchApiMemberOptionsForAdmin,
  fetchApiPendingAccounts,
} from "@/lib/api/account";
import { apiFetch } from "@/lib/api/server";
import type { ApiFamilyMember } from "@/lib/api/types";
import {
  EMPTY_BACKOFFICE_NOTICE_COUNTS,
  canDeleteFamilyMembers,
  canManageAccounts,
  canManageFamilyMembers,
  canReviewMemberChanges,
  canSubmitOwnDraft,
  type AccountProfile,
  type BackofficeNoticeCounts,
  type AccountRole,
  type AccountStatus,
  buildInternalAccountEmail,
  getAccountHomePath,
  hashIdCard,
  maskIdCard,
  normalizeIdCard,
  normalizeRealName,
} from "./shared";

export interface FamilyMemberOption {
  id: number;
  name: string;
  generation: number | null;
}

export interface BackofficeNavItem {
  href: string;
  label: string;
}

export async function getAccountProfileByAuthUserId(authUserId: string) {
  return apiFetch<AccountProfile | null>(`/api/accounts/by-auth-user/${authUserId}`, { cache: "no-store" });
}

export async function findAccountProfileByHashForAdmin(idCardHash: string) {
  return apiFetch<AccountProfile | null>(`/api/admin/accounts/by-id-card-hash/${idCardHash}`, { cache: "no-store" });
}

export async function findAccountProfileForLoginByAdmin(realName: string, idCard: string) {
  return apiFetch<AccountProfile | null>("/api/admin/accounts/login-profile", {
    method: "POST",
    body: { realName, idCard },
  });
}

export async function findInternalAuthUserByEmailForAdmin(_email: string) {
  return null;
}

export async function getCurrentAccountProfile() {
  try {
    const account = await apiFetch<{ profile: AccountProfile }>("/api/auth/me", { cache: "no-store" });
    return account.profile;
  } catch {
    return null;
  }
}

export async function findAccountProfileForLogin(realName: string, idCard: string) {
  return findAccountProfileForLoginByAdmin(realName, idCard);
}

export async function requireSignedInAccount() {
  const profile = await getCurrentAccountProfile();

  if (!profile) {
    throw new Error("请先登录");
  }

  return { user: { id: profile.auth_user_id }, profile };
}

export async function requireApprovedAccount() {
  const account = await requireSignedInAccount();

  if (account.profile.status !== "approved") {
    throw new Error("当前账号尚未通过审核");
  }

  return account;
}

export async function requireEditorAccount() {
  const account = await requireApprovedAccount();

  if (!canManageFamilyMembers(account.profile)) {
    throw new Error("当前账号无权维护族谱数据");
  }

  return account;
}

export async function requireReviewerAccount() {
  const account = await requireApprovedAccount();

  if (!canReviewMemberChanges(account.profile)) {
    throw new Error("当前账号无权审核资料草稿");
  }

  return account;
}

export async function requireAdminAccount() {
  const account = await requireApprovedAccount();

  if (!canManageAccounts(account.profile)) {
    throw new Error("仅管理员可以执行此操作");
  }

  return account;
}

export async function requireDraftOwnerAccount() {
  const account = await requireApprovedAccount();

  if (!canSubmitOwnDraft(account.profile)) {
    throw new Error("当前账号没有可编辑的绑定成员");
  }

  return account;
}

export async function listPendingAccounts() {
  return fetchApiPendingAccounts();
}

export async function getBackofficeNoticeCounts(
  profile: Pick<AccountProfile, "role" | "status"> | null,
): Promise<BackofficeNoticeCounts> {
  if (!profile || !canReviewMemberChanges(profile)) {
    return EMPTY_BACKOFFICE_NOTICE_COUNTS;
  }

  try {
    return await fetchApiBackofficeNoticeCounts();
  } catch {
    return EMPTY_BACKOFFICE_NOTICE_COUNTS;
  }
}

export function getBackofficeNavItems(
  profile: Pick<AccountProfile, "role" | "status"> | null,
): BackofficeNavItem[] {
  if (!profile) {
    return [];
  }

  const items: BackofficeNavItem[] = [];

  if (canManageFamilyMembers(profile)) {
    items.push({ href: "/family-tree", label: "成员列表" });
  }

  if (canReviewMemberChanges(profile)) {
    items.push({ href: "/review/member-changes", label: "草稿审核" });
  }

  if (canManageAccounts(profile)) {
    items.push({ href: "/admin/accounts", label: "账号审核" });
  }

  return items;
}

export async function listFamilyMemberOptions() {
  return fetchApiMemberOptionsForAdmin();
}

export async function getFamilyMemberById(memberId: number) {
  return apiFetch<ApiFamilyMember | null>(`/api/family-members/${memberId}`, { cache: "no-store" });
}

export async function getBoundMemberForCurrentAccount() {
  const profile = await getCurrentAccountProfile();

  if (!profile?.member_id) {
    return null;
  }

  return getFamilyMemberById(profile.member_id);
}

export function buildLoginCredentials(profile: Pick<AccountProfile, "id_card_hash">, idCard: string) {
  return {
    email: buildInternalAccountEmail(profile.id_card_hash),
    password: normalizeIdCard(idCard),
  };
}

export function createProfileInsertPayload(params: {
  authUserId: string;
  realName: string;
  idCard: string;
  role: AccountRole;
  status: AccountStatus;
}) {
  return {
    auth_user_id: params.authUserId,
    real_name: params.realName.trim(),
    real_name_normalized: normalizeRealName(params.realName),
    id_card_value: normalizeIdCard(params.idCard),
    id_card_hash: hashIdCard(params.idCard),
    id_card_masked: maskIdCard(params.idCard),
    role: params.role,
    member_id: null,
    status: params.status,
    approved_at: params.status === "approved" ? new Date().toISOString() : null,
    approved_by: null,
  };
}

export function getAccountRedirectPath(profile: Pick<AccountProfile, "status">) {
  return getAccountHomePath(profile);
}

export function assertRoleCanDelete(profile: Pick<AccountProfile, "role" | "status">) {
  if (!canDeleteFamilyMembers(profile)) {
    throw new Error("当前账号无权删除成员");
  }
}
