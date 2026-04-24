"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  fetchApiMyProfileContext,
  submitApiMemberChangeDraft,
  updateApiProfilePhone,
  withdrawApiMemberChangeDraft,
} from "@/lib/api/account";
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
  let pendingRequest: MemberChangeRequest | null = null;
  let historyRequests: MemberChangeRequest[] = [];
  let fatherName: string | null = null;
  let inferredMotherName: string | null = null;

  if (member?.father_id) {
    const father = await getFamilyMemberById(member.father_id);
    fatherName = typeof father?.name === "string" ? father.name : null;
    inferredMotherName = typeof father?.spouse === "string" ? father.spouse : null;
  }

  if (canSubmitOwnDraft(profile) && member) {
    const context = await fetchApiMyProfileContext();
    pendingRequest = context.pendingRequest;
    historyRequests = context.historyRequests;
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

  await requireApprovedAccount();

  try {
    await updateApiProfilePhone(phone);
  } catch (error) {
    redirect(`/me/profile?phoneError=${encodeURIComponent(error instanceof Error ? error.message : "手机号更新失败")}`);
  }

  revalidatePath("/me/profile");
  redirect(`/me/profile?phoneSuccess=${encodeURIComponent("手机号已更新")}`);
}

export async function submitMyDraftAction(formData: FormData) {
  await requireDraftOwnerAccount();
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

  try {
    await submitApiMemberChangeDraft(payload);
  } catch (error) {
    redirect(`/me/profile?draftError=${encodeURIComponent(error instanceof Error ? error.message : "草稿提交失败")}`);
  }

  revalidatePath("/me/profile");
  revalidatePath("/review/member-changes");
  redirect(`/me/profile?draftSuccess=${encodeURIComponent("草稿已提交，等待审核")}`);
}

export async function withdrawMyDraftAction(formData: FormData) {
  await requireDraftOwnerAccount();
  const requestId = formData.get("requestId");

  if (typeof requestId !== "string" || !requestId) {
    redirect(`/me/profile?historyError=${encodeURIComponent("缺少变更记录标识")}`);
  }

  try {
    await withdrawApiMemberChangeDraft(requestId);
  } catch (error) {
    redirect(`/me/profile?historyError=${encodeURIComponent(error instanceof Error ? error.message : "撤回失败")}`);
  }

  revalidatePath("/me/profile");
  revalidatePath("/review/member-changes");
  redirect(`/me/profile?historySuccess=${encodeURIComponent("待审核变更已撤回")}`);
}
