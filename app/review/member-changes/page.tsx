import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { BackendPageHeader } from "@/components/backend-page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlashToast } from "@/components/flash-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approveMemberChangeRequestAction,
  getPendingMemberChangeReviews,
  type PendingMemberChangeReview,
  rejectMemberChangeRequestAction,
} from "./actions";
import {
  getBackofficeNavItems,
  getCurrentAccountProfile,
} from "@/lib/account/server";
import { consumeFlashMessage } from "@/lib/flash";
import { canReviewMemberChanges, DRAFT_EDITABLE_FIELDS } from "@/lib/account/shared";
import { MemberChangeReviewDetailDialog } from "./member-change-review-detail-dialog";

const FIELD_LABELS: Record<(typeof DRAFT_EDITABLE_FIELDS)[number], string> = {
  spouse: "配偶",
  birthday: "生日",
  gender: "性别",
  is_alive: "在世状态",
  death_date: "离世日期",
  residence_place: "居住地",
  official_position: "官职",
  remarks: "生平事迹",
};

function normalizeDraftValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function getChangedFieldLabels(review: PendingMemberChangeReview) {
  return DRAFT_EDITABLE_FIELDS.filter((field) => {
    const currentValue = normalizeDraftValue(review.member[field]);
    const draftValue = normalizeDraftValue(review.request.payload[field]);
    return currentValue !== draftValue;
  }).map((field) => FIELD_LABELS[field]);
}

async function ReviewMemberChangesContent() {
  await connection();
  const profile = await getCurrentAccountProfile();
  const flash = await consumeFlashMessage();

  if (!profile) {
    redirect("/auth/login");
  }

  if (!canReviewMemberChanges(profile)) {
    redirect("/family-tree/graph");
  }

  const reviews = await getPendingMemberChangeReviews();
  const items = getBackofficeNavItems(profile);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <FlashToast flash={flash} />
      <BackendPageHeader
        title="草稿审核"
        description="这里处理普通用户提交的资料变更申请。"
        items={items}
      />

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>提交人</TableHead>
              <TableHead>绑定成员</TableHead>
              <TableHead>提交时间</TableHead>
              <TableHead>变更字段</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>详情</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  当前没有待审核草稿
                </TableCell>
              </TableRow>
            ) : (
              reviews.map((review) => {
                const changedFields = getChangedFieldLabels(review);

                return (
                  <TableRow key={review.request.id}>
                    <TableCell className="font-medium">{review.account.real_name}</TableCell>
                    <TableCell>{review.member.name}</TableCell>
                    <TableCell>
                      {new Date(review.request.created_at).toLocaleString("zh-CN", {
                        hour12: false,
                      })}
                    </TableCell>
                    <TableCell className="max-w-[320px] whitespace-normal">
                      {changedFields.length > 0 ? changedFields.join("、") : "未检测到差异"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">待审核</Badge>
                    </TableCell>
                    <TableCell>
                      <MemberChangeReviewDetailDialog review={review} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <form action={approveMemberChangeRequestAction}>
                          <input type="hidden" name="requestId" value={review.request.id} />
                          <Button type="submit" size="sm">
                            批准
                          </Button>
                        </form>
                        <form action={rejectMemberChangeRequestAction}>
                          <input type="hidden" name="requestId" value={review.request.id} />
                          <Button type="submit" size="sm" variant="outline">
                            驳回
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function ReviewMemberChangesPage() {
  return (
    <Suspense fallback={<div className="container mx-auto h-64 px-4 py-8" />}>
      <ReviewMemberChangesContent />
    </Suspense>
  );
}
