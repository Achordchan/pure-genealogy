"use server";

import { requireApprovedAccount } from "@/lib/account/server";
import { fetchApiFamilyMembers } from "@/lib/api/family";

export interface BiographyMember {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  gender: "男" | "女" | null;
  birthday: string | null;
  death_date: string | null;
  is_alive: boolean;
  spouse: string | null;
  official_position: string | null;
  residence_place: string | null;
  remarks: string;
  father_name: string | null;
}

export async function fetchMembersWithBiography(): Promise<{
  data: BiographyMember[];
  error: string | null;
}> {
  try {
    await requireApprovedAccount();
    const { items } = await fetchApiFamilyMembers();
    const data = items
      .filter((item) => hasBiographyContent(item.remarks))
      .map((item) => ({ ...item, remarks: item.remarks || "" }));
    return { data, error: null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : "读取生平册失败" };
  }
}

function hasBiographyContent(remarks: string | null) {
  if (!remarks) return false;
  try {
    const parsed = JSON.parse(remarks) as { children?: { text?: string }[] }[];
    return parsed.some((node) => node.children?.some((child) => child.text?.trim()));
  } catch {
    return remarks.trim().length > 0;
  }
}
