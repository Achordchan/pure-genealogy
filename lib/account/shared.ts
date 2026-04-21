import { createHash } from "crypto";

export const ACCOUNT_STATUSES = ["pending", "approved", "rejected"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface AccountProfile {
  id: string;
  auth_user_id: string;
  real_name: string;
  real_name_normalized: string;
  id_card_hash: string;
  id_card_masked: string;
  phone: string | null;
  status: AccountStatus;
  is_admin: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

const ID_CARD_REGEX = /^\d{17}[\dX]$/;

export function normalizeRealName(value: string) {
  return value.trim().replace(/\s+/gu, "");
}

export function normalizeIdCard(value: string) {
  const compact = value.trim().replace(/\s+/gu, "").toUpperCase();
  return compact.replace(/X$/u, "X");
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

export function getAccountHomePath(profile: Pick<AccountProfile, "status" | "is_admin">) {
  if (profile.is_admin || profile.status === "approved") {
    return "/family-tree/graph";
  }

  return "/auth/pending";
}

export function getPendingStatusText(status: AccountStatus) {
  if (status === "rejected") {
    return "审核未通过，请联系管理员核对身份信息。";
  }

  return "身份信息已提交，管理员审核通过后即可进入族谱系统。";
}
