import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canSubmitOwnDraft } from "@/lib/account/shared";
import { getMyDraftContext, submitMyDraftAction } from "../actions";

function pickDraftValue(
  pendingValue: string | null | undefined,
  currentValue: unknown,
) {
  if (pendingValue !== undefined) {
    return pendingValue ?? "";
  }

  return typeof currentValue === "string" ? currentValue : "";
}

async function MyDraftContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await connection();
  const { profile, member, pendingRequest } = await getMyDraftContext();
  const params = await searchParams;

  if (!profile) {
    redirect("/auth/login");
  }

  if (!canSubmitOwnDraft(profile) || !member) {
    redirect("/me/profile");
  }

  const payload = pendingRequest?.payload ?? {};

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>我的资料草稿</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>绑定成员：{String(member.name)}</p>
          <p>当前草稿状态：{pendingRequest ? "待审核" : "尚未提交"}</p>
          <p className="text-muted-foreground">
            这里只能修改个人资料字段，父子关系、世代和姓名结构仍由管理员或编辑员维护。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>提交草稿</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitMyDraftAction} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="spouse">配偶</Label>
                <Input id="spouse" name="spouse" defaultValue={pickDraftValue(payload.spouse, member.spouse)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="official_position">官职</Label>
                <Input
                  id="official_position"
                  name="official_position"
                  defaultValue={pickDraftValue(payload.official_position, member.official_position)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="birthday">生日</Label>
                <Input
                  id="birthday"
                  name="birthday"
                  type="date"
                  defaultValue={pickDraftValue(payload.birthday, member.birthday)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="death_date">忌日</Label>
                <Input
                  id="death_date"
                  name="death_date"
                  type="date"
                  defaultValue={pickDraftValue(payload.death_date, member.death_date)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="residence_place">居住地</Label>
              <Input
                id="residence_place"
                name="residence_place"
                defaultValue={pickDraftValue(payload.residence_place, member.residence_place)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="remarks">生平事迹</Label>
              <Textarea
                id="remarks"
                name="remarks"
                rows={8}
                defaultValue={pickDraftValue(payload.remarks, member.remarks)}
              />
            </div>

            {params.error && <p className="text-sm text-red-500">{decodeURIComponent(params.error)}</p>}
            {params.success && <p className="text-sm text-emerald-600">{decodeURIComponent(params.success)}</p>}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit">提交草稿</Button>
              <Button asChild variant="outline">
                <Link href="/me/profile">返回我的资料</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MyDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  return (
    <Suspense fallback={<div className="container mx-auto h-64 max-w-3xl px-4 py-8" />}>
      <MyDraftContent searchParams={searchParams} />
    </Suspense>
  );
}
