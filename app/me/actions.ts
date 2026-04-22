"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  let pendingRequest = null;
  let historyRequests: MemberChangeRequest[] = [];
  let fatherName: string | null = null;
  let inferredMotherName: string | null = null;

  if (member?.father_id) {
    const father = await getFamilyMemberById(member.father_id);
    fatherName = typeof father?.name === "string" ? father.name : null;
    inferredMotherName = typeof father?.spouse === "string" ? father.spouse : null;
  }

  if (canSubmitOwnDraft(profile) && member) {
    const supabase = await createClient();
    const [{ data, error }, { data: historyData, error: historyError }] = await Promise.all([
      supabase
        .from("member_change_requests")
        .select("*")
        .eq("account_profile_id", profile.id)
        .eq("status", "pending")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<MemberChangeRequest>(),
      supabase
        .from("member_change_requests")
        .select("*")
        .eq("account_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .returns<MemberChangeRequest[]>(),
    ]);

    if (error) {
      throw new Error(error.message);
    }

    if (historyError) {
      throw new Error(historyError.message);
    }

    pendingRequest = data;
    historyRequests = historyData ?? [];
  }

  return {
    profile,
    member,
    pendingRequest,
    historyRequests,
    fatherName,
    inferredMotherName,
  };
}

export async function updateMyPhoneAction(formData: FormData) {
  const phoneValue = formData.get("phone");
  const phone = typeof phoneValue === "string" ? phoneValue.trim() : "";

  if (!/^1\d{10}$/.test(phone)) {
    redirect(`/me/profile?phoneError=${encodeURIComponent("请输入正确的11位手机号")}`);
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
    redirect(`/me/profile?phoneError=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/me/profile");
  redirect(`/me/profile?phoneSuccess=${encodeURIComponent("手机号已更新")}`);
}

export async function submitMyDraftAction(formData: FormData) {
  const { supabase, profile } = await requireDraftOwnerAccount();
  const payload = sanitizeDraftPayload({
    spouse: formData.get("spouse"),
    birthday: formData.get("birthday"),
    gender: formData.get("gender"),
    is_alive: formData.get("is_alive"),
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
    redirect(`/me/profile?draftError=${encodeURIComponent(fetchError.message)}`);
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
    redirect(`/me/profile?draftError=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath("/me/profile");
  revalidatePath("/review/member-changes");
  redirect(`/me/profile?draftSuccess=${encodeURIComponent("草稿已提交，等待审核")}`);
}

export async function withdrawMyDraftAction(formData: FormData) {
  const { profile } = await requireDraftOwnerAccount();
  const requestId = formData.get("requestId");

  if (typeof requestId !== "string" || !requestId) {
    redirect(`/me/profile?historyError=${encodeURIComponent("缺少变更记录标识")}`);
  }

  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("member_change_requests")
    .select("*")
    .eq("id", requestId)
    .eq("account_profile_id", profile.id)
    .maybeSingle<MemberChangeRequest>();

    if (error) {
    redirect(`/me/profile?historyError=${encodeURIComponent(error.message)}`);
  }

  if (!request) {
    redirect(`/me/profile?historyError=${encodeURIComponent("未找到该变更记录")}`);
  }

  if (request.status !== "pending") {
    redirect(`/me/profile?historyError=${encodeURIComponent("只有待审核记录可以撤回")}`);
  }

  const adminClient = createAdminClient();
  const { error: deleteError } = await adminClient
    .from("member_change_requests")
    .delete()
    .eq("id", requestId);

  if (deleteError) {
    redirect(`/me/profile?historyError=${encodeURIComponent(deleteError.message)}`);
  }

  revalidatePath("/me/profile");
  revalidatePath("/review/member-changes");
  redirect(`/me/profile?historySuccess=${encodeURIComponent("待审核变更已撤回")}`);
}
