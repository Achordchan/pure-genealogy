import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { BackendPageHeader } from "@/components/backend-page-header";
import { FamilyMembersLoader } from "./family-members-loader";
import {
  getBackofficeNavItems,
  getBackofficeNoticeCounts,
  getCurrentAccountProfile,
} from "@/lib/account/server";

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

const SKELETON_ROWS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"];

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-9 w-64 bg-muted animate-pulse rounded-md" />
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
        </div>
      </div>
      <div className="border rounded-lg">
        <div className="h-10 bg-muted/50 border-b" />
        {SKELETON_ROWS.map((id) => (
          <div key={id} className="h-12 border-b animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}

async function FamilyMembersWrapper({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const search = params.search || "";
  const pageSize = 50;

  return <FamilyMembersLoader page={page} pageSize={pageSize} search={search} />;
}

async function FamilyTreeHeader() {
  await connection();
  const profile = await getCurrentAccountProfile();

  if (!profile) {
    redirect("/auth/login");
  }
  const noticeCounts = await getBackofficeNoticeCounts(profile);
  const items = getBackofficeNavItems(profile, noticeCounts);

  return (
    <BackendPageHeader
      title="成员列表"
      description="这里集中处理成员新增、编辑、导入和删除。"
      items={items}
    />
  );
}

export default function FamilyTreePage({ searchParams }: PageProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<div className="mb-6 h-24 rounded-lg bg-muted/40" />}>
        <FamilyTreeHeader />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <FamilyMembersWrapper searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
