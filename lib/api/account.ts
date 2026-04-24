import type { AccountRole, MemberChangeRequest } from "@/lib/account/shared";
import { apiFetch } from "./server";
import type {
  ApiAccountProfile,
  ApiActionResult,
  ApiBackofficeNoticeCounts,
  ApiMyProfileContext,
  ApiPendingMemberChangeReview,
} from "./types";

export function signUpApiAccount(input: { realName: string; idCard: string }) {
  return apiFetch<{ profile: ApiAccountProfile }>("/api/auth/sign-up", {
    method: "POST",
    body: input,
  });
}

export function updateApiProfilePhone(phone: string) {
  return apiFetch<ApiActionResult<{ phone: string }>>("/api/account/phone", {
    method: "PUT",
    body: { phone },
  });
}

export function updateApiPendingAccount(input: {
  accountId: string;
  status: "approved" | "rejected";
  role: AccountRole | null;
  memberId: number | null;
}) {
  return apiFetch<ApiActionResult<{ accountId: string }>>(`/api/admin/accounts/${input.accountId}/status`, {
    method: "PUT",
    body: input,
  });
}

export function fetchApiPendingAccounts() {
  return apiFetch<ApiAccountProfile[]>("/api/admin/accounts/pending", { cache: "no-store" });
}

export function fetchApiMemberOptionsForAdmin() {
  return apiFetch<{ id: number; name: string; generation: number | null }[]>("/api/admin/member-options", {
    cache: "no-store",
  });
}

export function fetchApiBackofficeNoticeCounts() {
  return apiFetch<ApiBackofficeNoticeCounts>("/api/admin/notices", { cache: "no-store" });
}

export function fetchApiMyProfileContext() {
  return apiFetch<ApiMyProfileContext>("/api/me/profile-context", { cache: "no-store" });
}

export function submitApiMemberChangeDraft(payload: MemberChangeRequest["payload"]) {
  return apiFetch<ApiActionResult<{ requestId: string }>>("/api/me/member-change-draft", {
    method: "PUT",
    body: { payload },
  });
}

export function withdrawApiMemberChangeDraft(requestId: string) {
  return apiFetch<ApiActionResult<{ requestId: string }>>(`/api/me/member-change-draft/${requestId}`, {
    method: "DELETE",
  });
}

export function fetchApiPendingMemberChangeReviews() {
  return apiFetch<ApiPendingMemberChangeReview[]>("/api/review/member-changes", { cache: "no-store" });
}

export function updateApiMemberChangeReview(input: {
  requestId: string;
  status: "approved" | "rejected";
  reviewComment: string;
}) {
  return apiFetch<ApiActionResult<{ requestId: string }>>(`/api/review/member-changes/${input.requestId}/status`, {
    method: "PUT",
    body: input,
  });
}
