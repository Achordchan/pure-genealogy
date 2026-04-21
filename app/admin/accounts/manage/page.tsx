import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getBackofficeNavItems,
  getBackofficeNoticeCounts,
  getCurrentAccountProfile,
} from "@/lib/account/server";
import { canManageAccounts } from "@/lib/account/shared";
import {
  getApprovedAccountsForAdmin,
  getMemberOptionsForAdmin,
  updateApprovedAccountAction,
} from "@/app/auth/actions";
import { BackendPageHeader } from "@/components/backend-page-header";

const ROLE_OPTIONS = [
  { value: "admin", label: "管理员" },
  { value: "editor", label: "编辑员" },
  { value: "member", label: "普通用户" },
];

async function ManageAccountsContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await connection();
  const profile = await getCurrentAccountProfile();
  const params = await searchParams;

  if (!profile) {
    redirect("/auth/login");
  }

  if (!canManageAccounts(profile)) {
    redirect("/family-tree/graph");
  }

  const [accounts, memberOptions] = await Promise.all([
    getApprovedAccountsForAdmin(),
    getMemberOptionsForAdmin(),
  ]);
  const noticeCounts = await getBackofficeNoticeCounts(profile);
  const items = getBackofficeNavItems(profile, noticeCounts);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <BackendPageHeader
        title="账号管理"
        description="这里调整已批准账号的角色和成员绑定。"
        items={items}
      />

      {params.error && <p className="text-sm text-red-500">{decodeURIComponent(params.error)}</p>}
      {params.success && <p className="text-sm text-emerald-600">{decodeURIComponent(params.success)}</p>}

      <div className="space-y-4">
        {accounts.map((account) => (
          <Card key={account.id}>
            <CardHeader>
              <CardTitle className="text-lg">{account.real_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateApprovedAccountAction} className="grid gap-4 lg:grid-cols-[1fr_200px_260px_auto]">
                <input type="hidden" name="accountId" value={account.id} />
                <div className="text-sm text-muted-foreground">
                  <p>身份证号：{account.id_card_masked}</p>
                  <p>手机号：{account.phone || "未填写"}</p>
                </div>
                <select
                  name="role"
                  defaultValue={account.role}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {ROLE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  name="memberId"
                  defaultValue={account.member_id?.toString() ?? ""}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">未绑定成员</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.generation ? `第${member.generation}世 ` : ""}{member.name}
                    </option>
                  ))}
                </select>
                <Button type="submit">保存</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ManageAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  return (
    <Suspense fallback={<div className="container mx-auto h-64 px-4 py-8" />}>
      <ManageAccountsContent searchParams={searchParams} />
    </Suspense>
  );
}
