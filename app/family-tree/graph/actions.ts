"use server";

import { requireApprovedAccount } from "@/lib/account/server";
import { fetchApiFamilyMembers } from "@/lib/api/family";

export interface FamilyMemberNode {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
  gender: "男" | "女" | null;
  official_position: string | null;
  is_alive: boolean;
  spouse: string | null;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
}

export interface FetchGraphResult {
  data: FamilyMemberNode[];
  error: string | null;
}

export async function fetchAllFamilyMembers(): Promise<FetchGraphResult> {
  try {
    await requireApprovedAccount();
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error.message : "当前账号无权访问",
    };
  }

  try {
    const { items } = await fetchApiFamilyMembers();
    return { data: items, error: null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : "读取族谱失败" };
  }
}
