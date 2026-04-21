"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getFamilyMemberById,
  requireApprovedAccount,
  requireDraftOwnerAccount,
} from "@/lib/account/server";
import {
  canSubmitOwnDraft,
  sanitizeDraftPayload,
  type MemberChangeRequest,
} from "@/lib/account/shared";

export async function getMyProfileContext() {
  const { profile } = await requireApprovedAccount();
  const member = profile.member_id ? await getFamilyMemberById(profile.member_id) : null;

  return { profile, member };
}

export async function updateMyPhoneAction(formData: FormData) {
  const phoneValue = formData.get("phone");
  const phone = typeof phoneValue === "string" ? phoneValue.trim() : "";

  if (!/^1\d{10}$/.test(phone)) {
    redirect(`/me/profile?error=${encodeURIComponent("请输入正确的11位手机号")}`);
  }

  const { supabase, profile } = await requireApprovedAccount();
  const { error } = await supabase
    .from("account_profiles")
    .update({
      phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) {
    redirect(`/me/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/me/profile");
  redirect(`/me/profile?success=${encodeURIComponent("手机号已更新")}`);
}

export async function getMyDraftContext() {
  const { profile } = await requireApprovedAccount();
  const member = profile.member_id ? await getFamilyMemberById(profile.member_id) : null;

  if (!canSubmitOwnDraft(profile) || !member) {
    return {
      profile,
      member,
      pendingRequest: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_change_requests")
    .select("*")
    .eq("account_profile_id", profile.id)
    .eq("status", "pending")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<MemberChangeRequest>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    profile,
    member,
    pendingRequest: data,
  };
}

export async function submitMyDraftAction(formData: FormData) {
  const { supabase, profile } = await requireDraftOwnerAccount();
  const payload = sanitizeDraftPayload({
    spouse: formData.get("spouse"),
    birthday: formData.get("birthday"),
    death_date: formData.get("death_date"),
    residence_place: formData.get("residence_place"),
    official_position: formData.get("official_position"),
    remarks: formData.get("remarks"),
  });

  const { data: existingRequest, error: fetchError } = await supabase
    .from("member_change_requests")
    .select("id")
    .eq("account_profile_id", profile.id)
    .eq("status", "pending")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (fetchError) {
    redirect(`/me/draft?error=${encodeURIComponent(fetchError.message)}`);
  }

  const draftRecord = {
    member_id: profile.member_id,
    payload,
    updated_at: new Date().toISOString(),
  };

  const result = existingRequest
    ? await supabase
        .from("member_change_requests")
        .update(draftRecord)
        .eq("id", existingRequest.id)
    : await supabase.from("member_change_requests").insert({
        account_profile_id: profile.id,
        ...draftRecord,
      });

  if (result.error) {
    redirect(`/me/draft?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/me/draft");
  revalidatePath("/review/member-changes");
  redirect(`/me/draft?success=${encodeURIComponent("草稿已提交，等待审核")}`);
}
