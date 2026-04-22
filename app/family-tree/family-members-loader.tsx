import { fetchFamilyMembers } from "./actions";
import { FamilyMembersTable } from "./family-members-table";
import { getCurrentAccountProfile } from "@/lib/account/server";
import {
  canDeleteFamilyMembers,
  canImportFamilyMembers,
  canManageAccounts,
} from "@/lib/account/shared";

interface FamilyMembersLoaderProps {
  page: number;
  pageSize: number;
  search: string;
}

export async function FamilyMembersLoader({
  page,
  pageSize,
  search,
}: FamilyMembersLoaderProps) {
  const { data, count, error } = await fetchFamilyMembers(page, pageSize, search);
  const profile = await getCurrentAccountProfile();

  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
        <p>加载数据失败: {error}</p>
      </div>
    );
  }

  return (
    <FamilyMembersTable
      initialData={data}
      totalCount={count}
      currentPage={page}
      pageSize={pageSize}
      searchQuery={search}
      canDelete={profile ? canDeleteFamilyMembers(profile) : false}
      canImport={profile ? canImportFamilyMembers(profile) : false}
      canManageAccounts={profile ? canManageAccounts(profile) : false}
    />
  );
}
