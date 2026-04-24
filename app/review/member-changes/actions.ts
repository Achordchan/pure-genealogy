"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  fetchApiPendingMemberChangeReviews,
  updateApiMemberChangeReview,
} from "@/lib/api/account";
import { requireReviewerAccount } from "@/lib/account/server";
import { setFlashMessage } from "@/lib/flash";
import {
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
    gender: "男" | "女" | null;
    is_alive: boolean;
    death_date: string | null;
    residence_place: string | null;
    official_position: string | null;
    remarks: string | null;
  };
}

export async function getPendingMemberChangeReviews() {
  await requireReviewerAccount();
  return fetchApiPendingMemberChangeReviews();
}

async function updateRequestStatus(formData: FormData, status: "approved" | "rejected") {
  await requireReviewerAccount();
  const requestId = formData.get("requestId");
  const reviewComment = formData.get("reviewComment");

  if (typeof requestId !== "string" || !requestId) {
    await setFlashMessage({ type: "error", message: "缺少申请标识" });
    redirect("/review/member-changes");
  }

  try {
    await updateApiMemberChangeReview({
      requestId,
      status,
      reviewComment: typeof reviewComment === "string" ? reviewComment.trim() : "",
    });
  } catch (error) {
    await setFlashMessage({ type: "error", message: error instanceof Error ? error.message : "审核失败" });
    redirect("/review/member-changes");
  }

  revalidatePath("/review/member-changes");
  revalidatePath("/me/profile");
  revalidatePath("/family-tree");
  revalidatePath("/family-tree/graph");
}

export async function approveMemberChangeRequestAction(formData: FormData) {
  await updateRequestStatus(formData, "approved");
  await setFlashMessage({ type: "success", message: "草稿已批准" });
  redirect("/review/member-changes");
}

export async function rejectMemberChangeRequestAction(formData: FormData) {
  await updateRequestStatus(formData, "rejected");
  await setFlashMessage({ type: "success", message: "草稿已驳回" });
  redirect("/review/member-changes");
}
