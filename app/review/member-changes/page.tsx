import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackendPageHeader } from "@/components/backend-page-header";
import { Button } from "@/components/ui/button";
import {
  approveMemberChangeRequestAction,
  getPendingMemberChangeReviews,
  rejectMemberChangeRequestAction,
} from "./actions";
import {
  getBackofficeNavItems,
  getBackofficeNoticeCounts,
  getCurrentAccountProfile,
} from "@/lib/account/server";
import { canReviewMemberChanges, DRAFT_EDITABLE_FIELDS } from "@/lib/account/shared";

const FIELD_LABELS: Record<(typeof DRAFT_EDITABLE_FIELDS)[number], string> = {
  spouse: "配偶",
  birthday: "生日",
  death_date: "忌日",
  residence_place: "居住地",
  official_position: "官职",
  remarks: "生平事迹",
};

function formatFieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "未填写";
  }

  return String(value);
}

async function ReviewMemberChangesContent({
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

  if (!canReviewMemberChanges(profile)) {
    redirect("/family-tree/graph");
  }

  const reviews = await getPendingMemberChangeReviews();
  const noticeCounts = await getBackofficeNoticeCounts(profile);
  const items = getBackofficeNavItems(profile, noticeCounts);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <BackendPageHeader
        title="草稿审核"
        description="这里处理普通用户提交的资料变更申请。"
        items={items}
      />

      {params.error && <p className="text-sm text-red-500">{decodeURIComponent(params.error)}</p>}
      {params.success && <p className="text-sm text-emerald-600">{decodeURIComponent(params.success)}</p>}

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            当前没有待审核草稿
          </CardContent>
        </Card>
      ) : (
        reviews.map(({ request, account, member }) => (
          <Card key={request.id}>
            <CardHeader>
              <CardTitle className="text-xl">
                {account.real_name} 提交的资料草稿
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                绑定成员：{member.name}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border">
                <div className="grid grid-cols-[140px_1fr_1fr] border-b bg-muted/30 px-4 py-3 text-sm font-medium">
                  <span>字段</span>
                  <span>当前正式资料</span>
                  <span>用户草稿</span>
                </div>
                {DRAFT_EDITABLE_FIELDS.map((field) => (
                  <div
                    key={field}
                    className="grid grid-cols-[140px_1fr_1fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0"
                  >
                    <span>{FIELD_LABELS[field]}</span>
                    <span>{formatFieldValue(member[field])}</span>
                    <span>{formatFieldValue(request.payload[field])}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <form action={approveMemberChangeRequestAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <Button type="submit">批准</Button>
                </form>
                <form action={rejectMemberChangeRequestAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <Button type="submit" variant="outline">驳回</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export default function ReviewMemberChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  return (
    <Suspense fallback={<div className="container mx-auto h-64 px-4 py-8" />}>
      <ReviewMemberChangesContent searchParams={searchParams} />
    </Suspense>
  );
}
