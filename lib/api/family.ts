import { apiFetch } from "./server";
import type {
  ApiActionResult,
  ApiFamilyMember,
  ApiFamilyMemberOption,
  ApiImportFamilyMemberInput,
  ApiMemberAccountSnapshot,
  ApiPageResult,
  ApiRitualDetail,
  ApiRitualSearchItem,
  ApiSaveFamilyMemberInput,
  ApiMemberAsset,
} from "./types";

export interface ApiFamilyMembersResponse {
  items: ApiFamilyMember[];
}

export interface ApiRitualsResponse {
  items: ApiRitualSearchItem[];
  generations: number[];
}

export function fetchApiFamilyMembers() {
  return apiFetch<ApiFamilyMembersResponse>("/api/family-members/graph", { cache: "no-store" });
}

export function fetchApiFamilyMembersPage(query: {
  page: number;
  pageSize: number;
  searchQuery?: string;
}) {
  return apiFetch<ApiPageResult<ApiFamilyMember>>("/api/family-members", {
    cache: "no-store",
    query: {
      page: query.page,
      pageSize: query.pageSize,
      searchQuery: query.searchQuery || undefined,
    },
  });
}

export function fetchApiFamilyMemberById(id: number) {
  return apiFetch<ApiFamilyMember>(`/api/family-members/${id}`, { cache: "no-store" });
}

export function fetchApiFamilyMemberOptions() {
  return apiFetch<ApiFamilyMemberOption[]>("/api/family-members/options", { cache: "no-store" });
}

export function fetchApiMemberAccount(memberId: number) {
  return apiFetch<ApiMemberAccountSnapshot | null>(`/api/family-members/${memberId}/account`, { cache: "no-store" });
}

export function saveApiFamilyMember(input: ApiSaveFamilyMemberInput) {
  return apiFetch<ApiActionResult<{ id: number }>>(
    input.id ? `/api/family-members/${input.id}` : "/api/family-members",
    {
      method: input.id ? "PUT" : "POST",
      body: { ...input },
    },
  );
}

export function deleteApiFamilyMembers(ids: number[]) {
  return apiFetch<ApiActionResult<{ deletedIds: number[] }>>("/api/family-members", {
    method: "DELETE",
    body: { ids },
  });
}

export function batchCreateApiFamilyMembers(members: ApiImportFamilyMemberInput[]) {
  return apiFetch<ApiActionResult<{ count: number }>>("/api/family-members/batch", {
    method: "POST",
    body: { members },
  });
}

export function fetchApiRituals(query: { q?: string; generation?: number | null }) {
  return apiFetch<ApiRitualsResponse>("/api/rituals", {
    cache: "no-store",
    query: {
      q: query.q || undefined,
      generation: query.generation ?? undefined,
    },
  });
}

export function fetchApiRitualDetail(memberId: number) {
  return apiFetch<ApiRitualDetail>(`/api/rituals/${memberId}`, { cache: "no-store" });
}

export function saveApiRitual(memberId: number, body: Record<string, unknown>) {
  return apiFetch<ApiActionResult<{ memberId: number }>>(`/api/rituals/${memberId}`, {
    method: "PUT",
    body,
  });
}

export function deleteApiRitual(memberId: number) {
  return apiFetch<ApiActionResult<{ memberId: number }>>(`/api/rituals/${memberId}`, { method: "DELETE" });
}

export function fetchApiMemberAssets(memberId: number, assetScope: "profile" | "ritual") {
  return apiFetch<{ items: ApiMemberAsset[] }>(`/api/members/${memberId}/assets`, {
    cache: "no-store",
    query: { assetScope },
  });
}
