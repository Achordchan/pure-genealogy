"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireReviewerAccount } from "@/lib/account/server";
import {
  DRAFT_EDITABLE_FIELDS,
  type AccountProfile,
  type MemberChangeRequest,
} from "@/lib/account/shared";

export interface PendingMemberChangeReview {
  request: MemberChangeRequest;
  account: Pick<AccountProfile, "id" | "real_name">;
  member: {
    id: number;
    name: string;
    spouse: string | null;
    birthday: string | null;
    death_date: string | null;
    residence_place: string | null;
    official_position: string | null;
    remarks: string | null;
  };
}

export async function getPendingMemberChangeReviews() {
  await requireReviewerAccount();
  const supabase = await createClient();
  const { data: requests, error } = await supabase
    .from("member_change_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<MemberChangeRequest[]>();

  if (error) {
    throw new Error(error.message);
  }

  const requestList = requests ?? [];
  const accountIds = Array.from(new Set(requestList.map((item) => item.account_profile_id)));
  const memberIds = Array.from(new Set(requestList.map((item) => item.member_id)));

  const [{ data: accounts }, { data: members }] = await Promise.all([
    supabase
      .from("account_profiles")
      .select("id, real_name")
      .in("id", accountIds)
      .returns<Pick<AccountProfile, "id" | "real_name">[]>(),
    supabase
      .from("family_members")
      .select("id, name, spouse, birthday, death_date, residence_place, official_position, remarks")
      .in("id", memberIds),
  ]);

  const accountMap = new Map((accounts ?? []).map((item) => [item.id, item]));
  const memberMap = new Map((members ?? []).map((item) => [item.id, item]));

  return requestList
    .map((request) => {
      const account = accountMap.get(request.account_profile_id);
      const member = memberMap.get(request.member_id);

      if (!account || !member) {
        return null;
      }

      return { request, account, member };
    })
    .filter((item): item is PendingMemberChangeReview => item !== null);
}

async function updateRequestStatus(formData: FormData, status: "approved" | "rejected") {
  const { supabase, user } = await requireReviewerAccount();
  const requestId = formData.get("requestId");
  const reviewComment = formData.get("reviewComment");

  if (typeof requestId !== "string" || !requestId) {
    redirect(`/review/member-changes?error=${encodeURIComponent("缺少申请标识")}`);
  }

  const { data: request, error: requestError } = await supabase
    .from("member_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle<MemberChangeRequest>();

  if (requestError || !request) {
    redirect(`/review/member-changes?error=${encodeURIComponent("未找到待审核草稿")}`);
  }

  if (status === "approved") {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    DRAFT_EDITABLE_FIELDS.forEach((field) => {
      if (field in request.payload) {
        updates[field] = request.payload[field] ?? null;
      }
    });

    const { error: memberError } = await supabase
      .from("family_members")
      .update(updates)
      .eq("id", request.member_id);

    if (memberError) {
      redirect(`/review/member-changes?error=${encodeURIComponent(memberError.message)}`);
    }
  }

  const { error: statusError } = await supabase
    .from("member_change_requests")
    .update({
      status,
      review_comment: typeof reviewComment === "string" ? reviewComment.trim() || null : null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (statusError) {
    redirect(`/review/member-changes?error=${encodeURIComponent(statusError.message)}`);
  }

  revalidatePath("/review/member-changes");
  revalidatePath("/me/draft");
  revalidatePath("/family-tree");
  revalidatePath("/family-tree/graph");
}

export async function approveMemberChangeRequestAction(formData: FormData) {
  await updateRequestStatus(formData, "approved");
  redirect(`/review/member-changes?success=${encodeURIComponent("草稿已批准")}`);
}

export async function rejectMemberChangeRequestAction(formData: FormData) {
  await updateRequestStatus(formData, "rejected");
  redirect(`/review/member-changes?success=${encodeURIComponent("草稿已驳回")}`);
}
