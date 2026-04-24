"use server";

import { revalidatePath } from "next/cache";

import { canEditRituals } from "@/lib/account/shared";
import { requireApprovedAccount, requireEditorAccount } from "@/lib/account/server";
import {
  deleteApiRitual,
  fetchApiRitualDetail,
  fetchApiRituals,
  saveApiRitual,
} from "@/lib/api/family";
import { ApiFetchError } from "@/lib/api/server";

export interface SaveMemberRitualInput {
  memberId: number;
  cemetery_name: string;
  area_block?: string | null;
  plot_number?: string | null;
  address: string;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  guide_text?: string | null;
  ritual_notes?: string | null;
}

export async function searchRitualMembers(params: { keyword?: string; generation?: number | null }) {
  await requireApprovedAccount();
  return fetchApiRituals({ q: params.keyword, generation: params.generation });
}

export async function getMemberRitualByMemberId(memberId: number) {
  await requireApprovedAccount();

  try {
    return await fetchApiRitualDetail(memberId);
  } catch (error) {
    if (error instanceof ApiFetchError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function fetchMemberRitualForEdit(memberId: number) {
  const account = await requireEditorAccount();

  if (!canEditRituals(account.profile)) {
    throw new Error("当前账号无权维护祭祀资料");
  }

  return getMemberRitualByMemberId(memberId);
}

export async function saveMemberRitual(input: SaveMemberRitualInput) {
  const account = await requireEditorAccount();

  if (!canEditRituals(account.profile)) {
    throw new Error("当前账号无权维护祭祀资料");
  }

  const payload = {
    cemetery_name: input.cemetery_name.trim(),
    area_block: input.area_block?.trim() || null,
    plot_number: input.plot_number?.trim() || null,
    address: input.address.trim(),
    province: input.province?.trim() || null,
    city: input.city?.trim() || null,
    district: input.district?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    contact_name: input.contact_name?.trim() || null,
    contact_phone: input.contact_phone?.trim() || null,
    guide_text: input.guide_text?.trim() || null,
    ritual_notes: input.ritual_notes?.trim() || null,
  };

  if (!payload.cemetery_name) {
    throw new Error("请填写墓园名称");
  }

  if (!payload.address) {
    throw new Error("请填写详细地址");
  }

  await saveApiRitual(input.memberId, payload);
  revalidateRitualPaths();
}

export async function deleteMemberRitual(memberId: number) {
  const account = await requireEditorAccount();

  if (!canEditRituals(account.profile)) {
    throw new Error("当前账号无权维护祭祀资料");
  }

  await deleteApiRitual(memberId);
  revalidateRitualPaths();
}

function revalidateRitualPaths() {
  revalidatePath("/family-tree", "layout");
  revalidatePath("/family-tree/graph");
  revalidatePath("/family-tree/graph-3d");
  revalidatePath("/family-tree/rituals");
}
