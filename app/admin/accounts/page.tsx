import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  approveAccountAction,
  getMemberOptionsForAdmin,
  getPendingAccountsForAdmin,
  rejectAccountAction,
} from "@/app/auth/actions";
import {
  getBackofficeNavItems,
  getCurrentAccountProfile,
} from "@/lib/account/server";
import { canManageAccounts } from "@/lib/account/shared";
import { Badge } from "@/components/ui/badge";
import { BackendPageHeader } from "@/components/backend-page-header";
import { Button } from "@/components/ui/button";
import { FlashToast } from "@/components/flash-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { consumeFlashMessage } from "@/lib/flash";

async function AccountsContent() {
  await connection();
  const profile = await getCurrentAccountProfile();
  const flash = await consumeFlashMessage();

  if (!profile) {
    redirect("/auth/login");
  }

  if (!canManageAccounts(profile)) {
    redirect("/family-tree/graph");
  }

  const [pendingAccounts, memberOptions] = await Promise.all([
    getPendingAccountsForAdmin(),
    getMemberOptionsForAdmin(),
  ]);
  const items = getBackofficeNavItems(profile);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <FlashToast flash={flash} />
      <BackendPageHeader
        title="账号审核"
        description="这里处理开放注册用户的审核、角色选择和成员绑定。"
        items={items}
      />

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>身份证号</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>批准角色</TableHead>
              <TableHead>绑定成员</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
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
                  <TableCell>
                    <select
                      form={`approve-${account.id}`}
                      name="role"
                      defaultValue="member"
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="member">普通用户</option>
                      <option value="editor">编辑员</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <select
                      form={`approve-${account.id}`}
                      name="memberId"
                      defaultValue=""
                      className="h-9 min-w-[220px] rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">请选择绑定成员</option>
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.generation ? `第${member.generation}世 ` : ""}{member.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <form id={`approve-${account.id}`} action={approveAccountAction}>
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

export default function AdminAccountsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto h-64 px-4 py-8" />}>
      <AccountsContent />
    </Suspense>
  );
}
