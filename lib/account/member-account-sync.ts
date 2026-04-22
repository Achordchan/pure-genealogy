import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildInternalAccountEmail,
  maskIdCard,
  normalizeIdCard,
  normalizeRealName,
  hashIdCard,
  validateIdCard,
  normalizeAccountRole,
  type AccountRole,
  type AccountProfile,
} from "./shared";

export interface MemberAccountSnapshot {
  id: string;
  auth_user_id: string;
  role: AccountRole;
  phone: string | null;
  id_card_value: string | null;
  status: AccountProfile["status"];
}

interface SyncMemberAccountInput {
  memberId: number;
  realName: string;
  approvedBy: string;
  idCard?: string;
  phone?: string | null;
  role?: string | null;
}

function normalizePhone(phone?: string | null) {
  const value = phone?.trim() ?? "";

  if (!value) {
    return null;
  }

  if (!/^1\d{10}$/.test(value)) {
    throw new Error("请输入正确的 11 位手机号");
  }

  return value;
}

function normalizeMemberRole(role?: string | null) {
  const normalizedRole = normalizeAccountRole(role);

  if (!normalizedRole) {
    return "member" as const;
  }

  if (normalizedRole === "admin") {
    throw new Error("成员账号只能设置为普通用户或编辑员");
  }

  return normalizedRole;
}

async function getAccountProfileByMemberIdWithClient(memberId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_profiles")
    .select("id, auth_user_id, role, phone, id_card_value, status")
    .eq("member_id", memberId)
    .maybeSingle<MemberAccountSnapshot>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getMemberAccountProfileForAdmin(memberId: number) {
  return getAccountProfileByMemberIdWithClient(memberId);
}

async function deleteAccountProfile(adminClient: ReturnType<typeof createAdminClient>, profile: Pick<AccountProfile, "id" | "auth_user_id">) {
  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(profile.auth_user_id);

  if (deleteUserError) {
    const { error: deleteProfileError } = await adminClient
      .from("account_profiles")
      .delete()
      .eq("id", profile.id);

    if (deleteProfileError) {
      throw new Error(deleteProfileError.message);
    }
  }
}

export async function syncMemberAccountForAdmin({
  memberId,
  realName,
  approvedBy,
  idCard,
  phone,
  role,
}: SyncMemberAccountInput) {
  const adminClient = createAdminClient();
  const normalizedRole = normalizeMemberRole(role);
  const normalizedPhone = normalizePhone(phone);
  const trimmedName = realName.trim();

  const { data: currentProfile, error: currentProfileError } = await adminClient
    .from("account_profiles")
    .select("*")
    .eq("member_id", memberId)
    .maybeSingle<AccountProfile>();

  if (currentProfileError) {
    throw new Error(currentProfileError.message);
  }

  if (currentProfile?.role === "admin") {
    throw new Error("管理员账号不能在成员弹窗中修改");
  }

  const normalizedIdCard = idCard?.trim() ? normalizeIdCard(idCard) : null;

  if (!normalizedIdCard) {
    if (currentProfile) {
      await deleteAccountProfile(adminClient, currentProfile);
    }
    return;
  }

  const idCardError = validateIdCard(normalizedIdCard);
  if (idCardError) {
    throw new Error(idCardError);
  }

  const idCardHash = hashIdCard(normalizedIdCard);
  const idCardMasked = maskIdCard(normalizedIdCard);
  const internalEmail = buildInternalAccountEmail(idCardHash);

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from("account_profiles")
    .select("*")
    .eq("id_card_hash", idCardHash)
    .maybeSingle<AccountProfile>();

  if (targetProfileError) {
    throw new Error(targetProfileError.message);
  }

  if (
    targetProfile &&
    targetProfile.id !== currentProfile?.id &&
    targetProfile.member_id !== null &&
    targetProfile.member_id !== memberId
  ) {
    throw new Error("该身份证号已绑定其他成员");
  }

  let workingProfile = currentProfile;

  if (workingProfile && targetProfile && workingProfile.id !== targetProfile.id) {
    await deleteAccountProfile(adminClient, workingProfile);
    workingProfile = null;
  }

  const profileToUse = targetProfile ?? workingProfile;

  if (profileToUse) {
    const { error: updateUserError } = await adminClient.auth.admin.updateUserById(profileToUse.auth_user_id, {
      email: internalEmail,
      password: normalizedIdCard,
      email_confirm: true,
      user_metadata: {
        real_name: trimmedName,
      },
    });

    if (updateUserError) {
      throw new Error(updateUserError.message);
    }

    const { error: updateProfileError } = await adminClient
      .from("account_profiles")
      .update({
        real_name: trimmedName,
        real_name_normalized: normalizeRealName(trimmedName),
        id_card_value: normalizedIdCard,
        id_card_hash: idCardHash,
        id_card_masked: idCardMasked,
        phone: normalizedPhone,
        role: normalizedRole,
        member_id: memberId,
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileToUse.id);

    if (updateProfileError) {
      throw new Error(updateProfileError.message);
    }

    return;
  }

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password: normalizedIdCard,
    email_confirm: true,
    user_metadata: {
      real_name: trimmedName,
    },
  });

  if (createUserError || !createdUser.user) {
    throw new Error(createUserError?.message ?? "创建账号失败");
  }

  const { error: insertProfileError } = await adminClient.from("account_profiles").insert({
    auth_user_id: createdUser.user.id,
    real_name: trimmedName,
    real_name_normalized: normalizeRealName(trimmedName),
    id_card_value: normalizedIdCard,
    id_card_hash: idCardHash,
    id_card_masked: idCardMasked,
    phone: normalizedPhone,
    role: normalizedRole,
    member_id: memberId,
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: approvedBy,
  });

  if (insertProfileError) {
    await adminClient.auth.admin.deleteUser(createdUser.user.id);
    throw new Error(insertProfileError.message);
  }
}
