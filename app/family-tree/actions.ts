"use server";

import { createClient } from "@/lib/supabase/server";
import {
  assertRoleCanDelete,
  requireApprovedAccount,
  requireEditorAccount,
} from "@/lib/account/server";
import { revalidatePath } from "next/cache";
import { canManageAccounts } from "@/lib/account/shared";
import {
  getMemberAccountProfileForAdmin,
  syncMemberAccountForAdmin,
  type MemberAccountSnapshot,
} from "@/lib/account/member-account-sync";
import {
  buildImportArchivePath,
  buildMemberAssetPath,
  GENEALOGY_ARCHIVE_BUCKET,
  MEMBER_ASSET_BUCKET,
  isImageMimeType,
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
  searchQuery: string = ""
): Promise<FetchMembersResult> {
  try {
    await requireEditorAccount();
  } catch (error) {
    return {
      data: [],
      count: 0,
      error: error instanceof Error ? error.message : "当前账号无权访问",
    };
  }

  const supabase = await createClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("family_members")
    .select("*", { count: "exact" });

  if (searchQuery.trim()) {
    query = query.ilike("name", `%${searchQuery.trim()}%`);
  }

  const { data, count, error } = await query
    .order("generation", { ascending: true })
    .order("sibling_order", { ascending: true })
    .range(from, to);

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  // 获取所有父亲 ID
  const fatherIds = (data || [])
    .map((item) => item.father_id)
    .filter((id): id is number => id !== null);

  // 批量查询父亲姓名
  let fatherMap: Record<number, string> = {};
  if (fatherIds.length > 0) {
    const { data: fathers } = await supabase
      .from("family_members")
      .select("id, name")
      .in("id", fatherIds);

    if (fathers) {
      fatherMap = Object.fromEntries(fathers.map((f) => [f.id, f.name]));
    }
  }

  // 转换数据格式，添加 father_name
  const transformedData: FamilyMember[] = (data || []).map((item) => ({
    ...item,
    father_name: item.father_id ? fatherMap[item.father_id] || null : null,
  }));

  return { data: transformedData, count: count || 0, error: null };
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
  account_profile: MemberAccountSnapshot | null;
}

async function persistFamilyMember(input: SaveFamilyMemberInput) {
  const supabase = await createClient();
  const payload = {
    name: input.name,
    generation: input.generation,
    sibling_order: input.sibling_order,
    father_id: input.father_id,
    gender: input.gender,
    official_position: input.official_position,
    is_alive: input.is_alive ?? true,
    spouse: input.spouse,
    remarks: input.remarks,
    birthday: input.birthday,
    death_date: input.death_date,
    residence_place: input.residence_place,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("family_members")
      .update(payload)
      .eq("id", input.id);

    if (error) {
      throw new Error(error.message);
    }

    return { memberId: input.id, isNew: false };
  }

  const { data, error } = await supabase
    .from("family_members")
    .insert(payload)
    .select("id")
    .single<{ id: number }>();

  if (error || !data) {
    throw new Error(error?.message ?? "创建成员失败");
  }

  return { memberId: data.id, isNew: true };
}

export async function saveFamilyMemberWithAccount(
  input: SaveFamilyMemberInput,
): Promise<{ success: boolean; error: string | null }> {
  let createdMemberId: number | null = null;

  try {
    const account = await requireEditorAccount();
    const { memberId, isNew } = await persistFamilyMember(input);

    if (isNew) {
      createdMemberId = memberId;
    }

    if (input.account) {
      if (!canManageAccounts(account.profile)) {
        throw new Error("仅管理员可以维护登录资料");
      }

      await syncMemberAccountForAdmin({
        memberId,
        realName: input.name,
        approvedBy: account.user.id,
        idCard: input.account.idCard,
        phone: input.account.phone,
        role: input.account.accountRole,
      });
    }

    revalidatePath("/family-tree", "layout");
    revalidatePath("/admin/accounts");
    revalidatePath("/", "layout");
    revalidatePath("/auth/pending");
    return { success: true, error: null };
  } catch (error) {
    if (createdMemberId !== null) {
      const supabase = await createClient();
      await supabase.from("family_members").delete().eq("id", createdMemberId);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "保存成员失败",
    };
  }
}

export async function deleteFamilyMembers(
  ids: number[]
): Promise<{ success: boolean; error: string | null }> {
  if (ids.length === 0) {
    return { success: false, error: "没有选择要删除的成员" };
  }

  try {
    const account = await requireEditorAccount();
    assertRoleCanDelete(account.profile);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "当前账号无权操作",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("family_members")
    .delete()
    .in("id", ids);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/family-tree", "layout");
  return { success: true, error: null };
}

// 获取所有成员用于父亲选择下拉框
export async function fetchAllMembersForSelect(): Promise<
  { id: number; name: string; generation: number | null }[]
> {
  try {
    await requireEditorAccount();
  } catch {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("family_members")
    .select("id, name, generation")
    .order("generation", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching members for select:", error);
    return [];
  }

  return data || [];
}

// 根据 ID 获取单个成员
export async function fetchMemberById(
  id: number
): Promise<FamilyMember | null> {
  try {
    await requireEditorAccount();
  } catch {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("family_members")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching member by id:", error);
    return null;
  }

  // 如果有父亲ID，查询父亲姓名
  let father_name: string | null = null;
  if (data.father_id) {
    const { data: father } = await supabase
      .from("family_members")
      .select("name")
      .eq("id", data.father_id)
      .single();
    father_name = father?.name || null;
  }

  return {
    ...data,
    father_name,
  } as FamilyMember;
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

    const accountProfile = canManageAccounts(account.profile)
      ? await getMemberAccountProfileForAdmin(id)
      : null;

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
  members: ImportMemberInput[]
): Promise<{ success: boolean; count: number; error: string | null }> {
  try {
    const account = await requireEditorAccount();
    assertRoleCanDelete(account.profile);
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : "当前账号无权操作",
    };
  }

  const supabase = await createClient();

  // 1. 提取所有不为空的父亲姓名
  const fatherNames = Array.from(
    new Set(
      members
        .map((m) => m.father_name?.trim())
        .filter((n): n is string => !!n)
    )
  );

  // 2. 批量查找父亲 ID
  const fatherMap: Record<string, number> = {};
  if (fatherNames.length > 0) {
    const { data: foundFathers } = await supabase
      .from("family_members")
      .select("id, name")
      .in("name", fatherNames);

    if (foundFathers) {
      foundFathers.forEach((f) => {
        // 注意：如果有重名，这里会覆盖，简单起见取最后一个。
        // 实际场景可能需要更复杂的匹配逻辑（如结合世代）
        fatherMap[f.name] = f.id;
      });
    }
  }

  // 3. 构建插入数据
  const insertPayload = members.map((m) => {
    let father_id: number | null = null;
    if (m.father_name && fatherMap[m.father_name.trim()]) {
      father_id = fatherMap[m.father_name.trim()];
    }

    return {
      name: m.name,
      generation: m.generation,
      sibling_order: m.sibling_order,
      father_id: father_id,
      gender: m.gender,
      official_position: m.official_position,
      is_alive: m.is_alive ?? true,
      spouse: m.spouse,
      remarks: m.remarks,
      birthday: m.birthday,
      residence_place: m.residence_place,
    };
  });

  // 4. 批量插入
  const { error } = await supabase.from("family_members").insert(insertPayload);

  if (error) {
    return { success: false, count: 0, error: error.message };
  }

  revalidatePath("/family-tree", "layout");
  return { success: true, count: members.length, error: null };
}

export async function uploadMemberAssetAction(
  formData: FormData,
): Promise<{ success: boolean; error: string | null }> {
  let path = "";

  try {
    await requireEditorAccount();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "当前账号无权上传成员资料",
    };
  }

  const memberIdRaw = formData.get("memberId");
  const file = formData.get("file");
  const memberId = typeof memberIdRaw === "string" ? Number(memberIdRaw) : NaN;

  if (!Number.isFinite(memberId)) {
    return { success: false, error: "缺少成员标识" };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "请选择要上传的图片" };
  }

  if (!isImageMimeType(file.type)) {
    return { success: false, error: "只支持上传图片文件" };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "图片大小不能超过 10 MB" };
  }

  const supabase = await createClient();
  const arrayBuffer = await file.arrayBuffer();
  path = buildMemberAssetPath(memberId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(MEMBER_ASSET_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await supabase.storage.from(MEMBER_ASSET_BUCKET).remove([path]);
    return { success: false, error: "登录状态已失效，请重新登录" };
  }

  const { error: insertError } = await supabase.from("member_assets").insert({
    member_id: memberId,
    bucket: MEMBER_ASSET_BUCKET,
    object_path: path,
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: user.id,
  });

  if (insertError) {
    await supabase.storage.from(MEMBER_ASSET_BUCKET).remove([path]);
    return { success: false, error: insertError.message };
  }

  revalidatePath("/family-tree", "layout");
  revalidatePath("/family-tree/graph");
  revalidatePath("/family-tree/graph-3d");
  revalidatePath("/family-tree/biography-book");
  return { success: true, error: null };
}

export async function archiveImportSourceAction(
  formData: FormData,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const account = await requireEditorAccount();
    assertRoleCanDelete(account.profile);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "当前账号无权归档导入文件",
    };
  }

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "缺少导入文件" };
  }

  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return { success: false, error: "只支持归档 Excel 或 CSV 导入文件" };
  }

  if (file.size > 25 * 1024 * 1024) {
    return { success: false, error: "导入文件大小不能超过 25 MB" };
  }

  const supabase = await createClient();
  const arrayBuffer = await file.arrayBuffer();
  const path = buildImportArchivePath(file.name);

  const { error } = await supabase.storage
    .from(GENEALOGY_ARCHIVE_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

export async function fetchMembersForTimeline(): Promise<
  { id: number; name: string; birthday: string | null; death_date: string | null; generation: number | null }[]
> {
  try {
    await requireApprovedAccount();
  } catch {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("family_members")
    .select("id, name, birthday, death_date, generation")
    .order("birthday", { ascending: true });

  if (error) {
    console.error("Error fetching timeline data:", error);
    return [];
  }

  return data || [];
}
