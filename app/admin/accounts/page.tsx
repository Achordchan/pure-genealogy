import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { approveAccountAction, getPendingAccountsForAdmin, rejectAccountAction } from "@/app/auth/actions";
import { getCurrentAccountProfile } from "@/lib/account/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function AccountsContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const profile = await getCurrentAccountProfile();
  const params = await searchParams;

  if (!profile) {
    redirect("/auth/login");
  }

  if (!profile.is_admin) {
    redirect("/family-tree/graph");
  }

  const pendingAccounts = await getPendingAccountsForAdmin();

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">账号审核</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            当前管理员：{profile.real_name}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/family-tree/graph">返回族谱</Link>
        </Button>
      </div>

      {params.error && <p className="text-sm text-red-500">{decodeURIComponent(params.error)}</p>}
      {params.success && <p className="text-sm text-emerald-600">{decodeURIComponent(params.success)}</p>}

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>身份证号</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  当前没有待审核账号
                </TableCell>
              </TableRow>
            ) : (
              pendingAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.real_name}</TableCell>
                  <TableCell>{account.id_card_masked}</TableCell>
                  <TableCell>{account.phone || "未填写"}</TableCell>
                  <TableCell>
                    {new Date(account.created_at).toLocaleString("zh-CN", {
                      hour12: false,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">待审核</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <form action={approveAccountAction}>
                        <input type="hidden" name="accountId" value={account.id} />
                        <Button type="submit" size="sm">
                          批准
                        </Button>
                      </form>
                      <form action={rejectAccountAction}>
                        <input type="hidden" name="accountId" value={account.id} />
                        <Button type="submit" size="sm" variant="outline">
                          拒绝
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  return (
    <Suspense fallback={<div className="container mx-auto h-64 px-4 py-8" />}>
      <AccountsContent searchParams={searchParams} />
    </Suspense>
  );
}
