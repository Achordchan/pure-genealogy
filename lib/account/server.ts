import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  type AccountProfile,
  type AccountStatus,
  buildInternalAccountEmail,
  getAccountHomePath,
  hashIdCard,
  normalizeIdCard,
  normalizeRealName,
} from "./shared";

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
  const realNameNormalized = normalizeRealName(realName);
  const idCardHash = hashIdCard(idCard);

  const { data, error } = await supabase
    .from("account_profiles")
    .select("*")
    .eq("real_name_normalized", realNameNormalized)
    .eq("id_card_hash", idCardHash)
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

  if (!account.profile.is_admin && account.profile.status !== "approved") {
    throw new Error("当前账号尚未通过审核");
  }

  return account;
}

export async function requireAdminAccount() {
  const account = await requireSignedInAccount();

  if (!account.profile.is_admin) {
    throw new Error("仅管理员可以执行此操作");
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
  isAdmin: boolean;
  status: AccountStatus;
}) {
  const realNameNormalized = normalizeRealName(params.realName);
  const idCardHash = hashIdCard(params.idCard);

  return {
    auth_user_id: params.authUserId,
    real_name: params.realName.trim(),
    real_name_normalized: realNameNormalized,
    id_card_hash: idCardHash,
    id_card_masked: `${normalizeIdCard(params.idCard).slice(0, 6)}********${normalizeIdCard(params.idCard).slice(-4)}`,
    status: params.status,
    is_admin: params.isAdmin,
    approved_at: params.status === "approved" ? new Date().toISOString() : null,
    approved_by: null,
  };
}

export function getAccountRedirectPath(profile: Pick<AccountProfile, "status" | "is_admin">) {
  return getAccountHomePath(profile);
}
