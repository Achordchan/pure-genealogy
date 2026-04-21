import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  canDeleteFamilyMembers,
  canManageAccounts,
  canManageFamilyMembers,
  canReviewMemberChanges,
  canSubmitOwnDraft,
  type AccountProfile,
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

export interface BackofficeNoticeCounts {
  pendingAccounts: number;
  pendingMemberChanges: number;
  total: number;
}

export interface BackofficeNavItem {
  href: string;
  label: string;
  badgeCount?: number;
}

export async function getAccountProfileByAuthUserId(authUserId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle<AccountProfile>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getCurrentAccountProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getAccountProfileByAuthUserId(user.id);
}

export async function findAccountProfileForLogin(realName: string, idCard: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_profiles")
    .select("*")
    .eq("real_name_normalized", normalizeRealName(realName))
    .eq("id_card_hash", hashIdCard(idCard))
    .maybeSingle<AccountProfile>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function requireSignedInAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("请先登录");
  }

  const profile = await getAccountProfileByAuthUserId(user.id);

  if (!profile) {
    throw new Error("账号资料不存在");
  }

  return { supabase, user, profile };
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_profiles")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<AccountProfile[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getBackofficeNoticeCounts(
  profile: Pick<AccountProfile, "role" | "status"> | null,
): Promise<BackofficeNoticeCounts> {
  if (!profile) {
    return {
      pendingAccounts: 0,
      pendingMemberChanges: 0,
      total: 0,
    };
  }

  const supabase = await createClient();

  const [pendingAccounts, pendingMemberChanges] = await Promise.all([
    canManageAccounts(profile)
      ? supabase
          .from("account_profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0, error: null }),
    canReviewMemberChanges(profile)
      ? supabase
          .from("member_change_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (pendingAccounts.error) {
    throw new Error(pendingAccounts.error.message);
  }

  if (pendingMemberChanges.error) {
    throw new Error(pendingMemberChanges.error.message);
  }

  const pendingAccountsCount = pendingAccounts.count ?? 0;
  const pendingMemberChangesCount = pendingMemberChanges.count ?? 0;

  return {
    pendingAccounts: pendingAccountsCount,
    pendingMemberChanges: pendingMemberChangesCount,
    total: pendingAccountsCount + pendingMemberChangesCount,
  };
}

export function getBackofficeNavItems(
  profile: Pick<AccountProfile, "role" | "status"> | null,
  counts: BackofficeNoticeCounts,
): BackofficeNavItem[] {
  if (!profile) {
    return [];
  }

  const items: BackofficeNavItem[] = [];

  if (canManageFamilyMembers(profile)) {
    items.push({ href: "/family-tree", label: "成员列表" });
  }

  if (canReviewMemberChanges(profile)) {
    items.push({
      href: "/review/member-changes",
      label: "草稿审核",
      badgeCount: counts.pendingMemberChanges,
    });
  }

  if (canManageAccounts(profile)) {
    items.push({
      href: "/admin/accounts",
      label: "账号审核",
      badgeCount: counts.pendingAccounts,
    });
    items.push({
      href: "/admin/accounts/manage",
      label: "账号管理",
    });
  }

  return items;
}

export async function listApprovedAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_profiles")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .returns<AccountProfile[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listFamilyMemberOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .select("id, name, generation")
    .order("generation", { ascending: true })
    .order("sibling_order", { ascending: true })
    .returns<FamilyMemberOption[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getFamilyMemberById(memberId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .select("*")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
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
