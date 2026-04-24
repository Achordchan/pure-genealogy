"use server";

import {
  batchCreateApiFamilyMembers,
  fetchApiFamilyMembers,
  deleteApiFamilyMembers,
  fetchApiFamilyMemberById,
  fetchApiFamilyMemberOptions,
  fetchApiFamilyMembersPage,
  fetchApiMemberAccount,
  saveApiFamilyMember,
} from "@/lib/api/family";
import {
  assertRoleCanDelete,
  requireApprovedAccount,
  requireEditorAccount,
} from "@/lib/account/server";
import type { ApiMemberAccountSnapshot } from "@/lib/api/types";
import { revalidatePath } from "next/cache";
import {
  type MemberAssetScope,
  isImageMimeType,
  isSupportedMemberAssetMimeType,
  isVideoMimeType,
} from "@/lib/storage/shared";

export interface FamilyMember {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_id: number | null;
  father_name: string | null;
  gender: "男" | "女" | null;
  official_position: string | null;
  is_alive: boolean;
  spouse: string | null;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
  updated_at: string;
}

export interface FetchMembersResult {
  data: FamilyMember[];
  count: number;
  error: string | null;
}

export async function fetchFamilyMembers(
  page: number = 1,
  pageSize: number = 50,
  searchQuery: string = "",
): Promise<FetchMembersResult> {
  try {
    await requireEditorAccount();
    const result = await fetchApiFamilyMembersPage({ page, pageSize, searchQuery });
    return { data: result.data, count: result.count, error: null };
  } catch (error) {
    return {
      data: [],
      count: 0,
      error: error instanceof Error ? error.message : "读取成员失败",
    };
  }
}


export interface CreateMemberInput {
  name: string;
  generation?: number | null;
  sibling_order?: number | null;
  father_id?: number | null;
  gender?: "男" | "女" | null;
  official_position?: string | null;
  is_alive?: boolean;
  spouse?: string | null;
  remarks?: string | null;
  birthday?: string | null;
  death_date?: string | null;
  residence_place?: string | null;
}

export interface MemberAccountInput {
  idCard?: string;
  phone?: string | null;
  accountRole?: "member" | "editor";
  removeAccount?: boolean;
}

export interface SaveFamilyMemberInput extends CreateMemberInput {
  id?: number;
  account?: MemberAccountInput;
}

export interface EditableFamilyMember extends FamilyMember {
  account_profile: ApiMemberAccountSnapshot | null;
}

async function persistFamilyMember(input: SaveFamilyMemberInput) {
  const result = await saveApiFamilyMember({
    id: input.id,
    name: input.name,
    generation: input.generation ?? null,
    sibling_order: input.sibling_order ?? null,
    father_id: input.father_id ?? null,
    gender: input.gender ?? null,
    official_position: input.official_position ?? null,
    is_alive: input.is_alive ?? true,
    spouse: input.spouse ?? null,
    remarks: input.remarks ?? null,
    birthday: input.birthday ?? null,
    death_date: input.death_date ?? null,
    residence_place: input.residence_place ?? null,
    account: input.account,
  });
  return { memberId: result.data.id, isNew: !input.id };
}


export async function saveFamilyMemberWithAccount(
  input: SaveFamilyMemberInput,
): Promise<{ success: boolean; error: string | null }> {
  let createdMemberId: number | null = null;

  try {
    await requireEditorAccount();
    const { memberId, isNew } = await persistFamilyMember(input);

    if (isNew) {
      createdMemberId = memberId;
    }

    revalidatePath("/family-tree", "layout");
    revalidatePath("/admin/accounts");
    revalidatePath("/", "layout");
    revalidatePath("/auth/pending");
    return { success: true, error: null };
  } catch (error) {
    if (createdMemberId !== null) {
      await deleteApiFamilyMembers([createdMemberId]).catch(() => null);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "保存成员失败",
    };
  }
}

export async function deleteFamilyMembers(
  ids: number[],
): Promise<{ success: boolean; error: string | null }> {
  if (ids.length === 0) {
    return { success: false, error: "没有选择要删除的成员" };
  }

  try {
    const account = await requireEditorAccount();
    assertRoleCanDelete(account.profile);
    await deleteApiFamilyMembers(ids);
    revalidatePath("/family-tree", "layout");
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "删除成员失败" };
  }
}


// 获取所有成员用于父亲选择下拉框
export async function fetchAllMembersForSelect(): Promise<
  { id: number; name: string; generation: number | null }[]
> {
  try {
    await requireEditorAccount();
    return await fetchApiFamilyMemberOptions();
  } catch {
    return [];
  }
}


// 根据 ID 获取单个成员
export async function fetchMemberById(
  id: number,
): Promise<FamilyMember | null> {
  try {
    await requireEditorAccount();
    return await fetchApiFamilyMemberById(id);
  } catch {
    return null;
  }
}


export async function fetchEditableMemberById(
  id: number,
): Promise<EditableFamilyMember | null> {
  try {
    const account = await requireEditorAccount();
    const member = await fetchMemberById(id);

    if (!member) {
      return null;
    }

    const accountProfile = account.profile.role === "admin" ? await fetchApiMemberAccount(id) : null;

    return {
      ...member,
      account_profile: accountProfile,
    };
  } catch {
    return null;
  }
}

export interface ImportMemberInput {
  name: string;
  generation?: number | null;
  sibling_order?: number | null;
  father_name?: string | null; // 导入时使用姓名匹配
  gender?: "男" | "女" | null;
  official_position?: string | null;
  is_alive?: boolean;
  spouse?: string | null;
  remarks?: string | null;
  birthday?: string | null;
  residence_place?: string | null;
}

export async function batchCreateFamilyMembers(
  members: ImportMemberInput[],
): Promise<{ success: boolean; count: number; error: string | null }> {
  try {
    const account = await requireEditorAccount();
    assertRoleCanDelete(account.profile);
    const result = await batchCreateApiFamilyMembers(members.map((member) => ({
      name: member.name,
      generation: member.generation ?? null,
      sibling_order: member.sibling_order ?? null,
      father_id: null,
      father_name: member.father_name ?? null,
      gender: member.gender ?? null,
      official_position: member.official_position ?? null,
      is_alive: member.is_alive ?? true,
      spouse: member.spouse ?? null,
      remarks: member.remarks ?? null,
      birthday: member.birthday ?? null,
      death_date: null,
      residence_place: member.residence_place ?? null,
    })));
    revalidatePath("/family-tree", "layout");
    return { success: true, count: result.data.count, error: null };
  } catch (error) {
    return { success: false, count: 0, error: error instanceof Error ? error.message : "批量导入失败" };
  }
}


export async function fetchMembersForTimeline(): Promise<
  { id: number; name: string; birthday: string | null; death_date: string | null; generation: number | null }[]
> {
  try {
    await requireApprovedAccount();
    const { items } = await fetchApiFamilyMembers();
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      birthday: item.birthday,
      death_date: item.death_date,
      generation: item.generation,
    }));
  } catch {
    return [];
  }
}
