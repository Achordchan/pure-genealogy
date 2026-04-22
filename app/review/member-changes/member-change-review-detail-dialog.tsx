"use client";

import { AppDialogShell } from "@/components/app-dialog-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { RichTextViewer } from "@/components/rich-text/viewer";
import { DRAFT_EDITABLE_FIELDS } from "@/lib/account/shared";
import type { PendingMemberChangeReview } from "./actions";

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

function renderFieldValue(
  field: (typeof DRAFT_EDITABLE_FIELDS)[number],
  value: unknown,
) {
  if (value === null || value === undefined || value === "") {
    return "未填写";
  }

  if (field === "is_alive") {
    return String(value) === "true" || value === true ? "在世" : "已故";
  }

  if (field === "remarks") {
    return <RichTextViewer value={String(value)} className="text-sm" />;
  }

  return String(value);
}

export function MemberChangeReviewDetailDialog({
  review,
}: {
  review: PendingMemberChangeReview;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          查看详情
        </Button>
      </DialogTrigger>
      <AppDialogShell
        title={`${review.account.real_name} 的草稿详情`}
        description={`绑定成员：${review.member.name}`}
        contentClassName="sm:max-w-4xl"
        bodyClassName="space-y-4"
      >
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
              <div className="min-w-0 break-words">
                {renderFieldValue(field, review.member[field])}
              </div>
              <div className="min-w-0 break-words">
                {renderFieldValue(field, review.request.payload[field])}
              </div>
            </div>
          ))}
        </div>
      </AppDialogShell>
    </Dialog>
  );
}
