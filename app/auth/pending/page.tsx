import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentPendingProfile, updatePendingPhoneAction } from "../actions";
import { getAccountHomePath, getPendingStatusText } from "@/lib/account/shared";

async function PendingContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const profile = await getCurrentPendingProfile();
  const params = await searchParams;

  if (!profile) {
    redirect("/auth/login");
  }

  if (profile.is_admin || profile.status === "approved") {
    redirect(getAccountHomePath(profile));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">信息正在审核中</CardTitle>
        <CardDescription>{getPendingStatusText(profile.status)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
          <p>姓名：{profile.real_name}</p>
          <p>身份证号：{profile.id_card_masked}</p>
          <p>当前手机号：{profile.phone || "未填写"}</p>
        </div>

        <form action={updatePendingPhoneAction} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="phone">补充手机号</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              defaultValue={profile.phone ?? ""}
              placeholder="请输入11位手机号"
              required
            />
          </div>
          {params.error && <p className="text-sm text-red-500">{decodeURIComponent(params.error)}</p>}
          {params.success && <p className="text-sm text-emerald-600">{decodeURIComponent(params.success)}</p>}
          <Button type="submit" className="w-full">
            保存手机号
          </Button>
        </form>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" className="w-full">
            <Link href="/">返回首页</Link>
          </Button>
          <LogoutButton className="w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-lg">
        <Suspense fallback={<div className="h-80 rounded-xl border bg-background/70" />}>
          <PendingContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
