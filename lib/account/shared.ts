import { createHash } from "crypto";

export const ACCOUNT_STATUSES = ["pending", "approved", "rejected"] as const;
export const ACCOUNT_ROLES = ["admin", "editor", "member"] as const;
export const DRAFT_EDITABLE_FIELDS = [
  "spouse",
  "birthday",
  "gender",
  "is_alive",
  "death_date",
  "residence_place",
  "official_position",
  "remarks",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export type DraftEditableField = (typeof DRAFT_EDITABLE_FIELDS)[number];

export interface AccountProfile {
  id: string;
  auth_user_id: string;
  real_name: string;
  real_name_normalized: string;
  id_card_value: string | null;
  id_card_hash: string;
  id_card_masked: string;
  phone: string | null;
  status: AccountStatus;
  role: AccountRole;
  member_id: number | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberChangeRequest {
  id: string;
  account_profile_id: string;
  member_id: number;
  payload: Partial<Record<DraftEditableField, string | null>>;
  status: AccountStatus;
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackofficeNoticeCounts {
  pending_accounts: number;
  pending_member_changes: number;
  total: number;
}

export const EMPTY_BACKOFFICE_NOTICE_COUNTS: BackofficeNoticeCounts = {
  pending_accounts: 0,
  pending_member_changes: 0,
  total: 0,
};

const ID_CARD_REGEX = /^\d{17}[\dX]$/;

export function normalizeRealName(value: string) {
  return value.trim().replace(/\s+/gu, "");
}

export function normalizeIdCard(value: string) {
  return value.trim().replace(/\s+/gu, "").toUpperCase();
}

export function validateRealName(value: string) {
  const normalized = normalizeRealName(value);

  if (normalized.length < 2 || normalized.length > 20) {
    return "姓名长度必须在 2 到 20 个字符之间";
  }

  return null;
}

export function validateIdCard(value: string) {
  const normalized = normalizeIdCard(value);

  if (!ID_CARD_REGEX.test(normalized)) {
    return "请输入正确的 18 位身份证号";
  }

  return null;
}

export function maskIdCard(value: string) {
  const normalized = normalizeIdCard(value);
  return `${normalized.slice(0, 6)}********${normalized.slice(-4)}`;
}

export function hashIdCard(value: string) {
  const salt = process.env.ACCOUNT_ID_HASH_SALT?.trim();

  if (!salt) {
    throw new Error("缺少 ACCOUNT_ID_HASH_SALT 配置");
  }

  return createHash("sha256")
    .update(`${salt}:${normalizeIdCard(value)}`)
    .digest("hex");
}

export function buildInternalAccountEmail(idCardHash: string) {
  const normalizedHash = idCardHash.toLowerCase();
  const uuid = [
    normalizedHash.slice(0, 8),
    normalizedHash.slice(8, 12),
    `5${normalizedHash.slice(13, 16)}`,
    `a${normalizedHash.slice(17, 20)}`,
    normalizedHash.slice(20, 32),
  ].join("-");

  return `acct_${uuid}@auth.local`;
}

export function getInitialAdminHashes() {
  return new Set(
    (process.env.INITIAL_ADMIN_ID_HASHES ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function isApprovedAccount(profile: Pick<AccountProfile, "status">) {
  return profile.status === "approved";
}

export function isAdminRole(profile: Pick<AccountProfile, "role">) {
  return profile.role === "admin";
}

export function isEditorRole(profile: Pick<AccountProfile, "role">) {
  return profile.role === "editor";
}

export function canManageAccounts(profile: Pick<AccountProfile, "role" | "status">) {
  return isApprovedAccount(profile) && isAdminRole(profile);
}

export function canManageFamilyMembers(profile: Pick<AccountProfile, "role" | "status">) {
  return isApprovedAccount(profile) && (isAdminRole(profile) || isEditorRole(profile));
}

export function canDeleteFamilyMembers(profile: Pick<AccountProfile, "role" | "status">) {
  return isApprovedAccount(profile) && isAdminRole(profile);
}

export function canImportFamilyMembers(profile: Pick<AccountProfile, "role" | "status">) {
  return canDeleteFamilyMembers(profile);
}

export function canReviewMemberChanges(profile: Pick<AccountProfile, "role" | "status">) {
  return isApprovedAccount(profile) && (isAdminRole(profile) || isEditorRole(profile));
}

export function canSubmitOwnDraft(profile: Pick<AccountProfile, "role" | "status" | "member_id">) {
  return isApprovedAccount(profile) && profile.role === "member" && profile.member_id !== null;
}

export function canViewMaintenancePage(profile: Pick<AccountProfile, "role" | "status">) {
  return canManageFamilyMembers(profile);
}

export function getAccountHomePath(profile: Pick<AccountProfile, "status">) {
  if (!isApprovedAccount(profile)) {
    return "/auth/pending";
  }

  return "/family-tree/graph";
}

export function getPendingStatusText(status: AccountStatus) {
  if (status === "rejected") {
    return "审核未通过，请联系管理员核对身份信息。";
  }

  return "身份信息已提交，管理员审核通过后即可进入族谱系统。";
}

export function normalizeAccountRole(value: string | null | undefined): AccountRole | null {
  if (value === "admin" || value === "editor" || value === "member") {
    return value;
  }

  return null;
}

export function sanitizeDraftPayload(
  payload: Record<string, FormDataEntryValue | string | null | undefined>,
) {
  const sanitized: Partial<Record<DraftEditableField, string | null>> = {};

  DRAFT_EDITABLE_FIELDS.forEach((field) => {
    const value = payload[field];
    sanitized[field] = typeof value === "string" ? value.trim() || null : null;
  });

  return sanitized;
}
