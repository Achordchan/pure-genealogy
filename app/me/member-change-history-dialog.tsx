"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AppDialogShell } from "@/components/app-dialog-shell";
import { RichTextViewer } from "@/components/rich-text/viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { withdrawMyDraftAction } from "./actions";
import type { DraftEditableField, MemberChangeRequest } from "@/lib/account/shared";

const FIELD_LABELS: Record<DraftEditableField, string> = {
  spouse: "配偶",
  birthday: "生日",
  gender: "性别",
  is_alive: "在世状态",
  death_date: "离世日期",
  residence_place: "居住地",
  official_position: "官职",
  remarks: "生平事迹",
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusMeta(status: MemberChangeRequest["status"]) {
  if (status === "approved") {
    return {
      label: "已更新",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (status === "rejected") {
    return {
      label: "已驳回",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    label: "待审核",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function renderFieldValue(field: DraftEditableField, value: string | null | undefined) {
  if (!value) {
    return <span className="text-muted-foreground">未填写</span>;
  }

  if (field === "is_alive") {
    return <span>{value === "true" ? "在世" : "已故"}</span>;
  }

  if (field === "remarks") {
    return <RichTextViewer value={value} className="text-sm" />;
  }

  return <span>{value}</span>;
}

function WithdrawButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" variant="destructive" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? "撤回中..." : "撤回审核"}
    </Button>
  );
}

export function MemberChangeHistoryDialog({
  open,
  onOpenChange,
  publishedValues,
  requests,
  error,
  success,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publishedValues: Partial<Record<DraftEditableField, string | null>>;
  requests: MemberChangeRequest[];
  error?: string;
  success?: string;
}) {
  const [selectedRequest, setSelectedRequest] = useState<MemberChangeRequest | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <AppDialogShell
          title="变更历史"
          description="这里可以查看当前已发布资料，以及你提交过的全部变更记录。"
          contentClassName="sm:max-w-3xl"
          bodyClassName="space-y-6"
        >
          <section className="space-y-4 rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 dark:border-stone-800 dark:bg-stone-900/30">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">当前已发布资料</h3>
              <Badge variant="secondary">当前生效</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <div key={field} className="space-y-2 rounded-lg border bg-background px-4 py-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="text-sm">
                    {renderFieldValue(field as DraftEditableField, publishedValues[field as DraftEditableField])}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error ? <p className="text-sm text-red-500">{decodeURIComponent(error)}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{decodeURIComponent(success)}</p> : null}

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">历史变更记录</h3>
              <span className="text-sm text-muted-foreground">共 {requests.length} 条</span>
            </div>

            {requests.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                你还没有提交过资料变更。
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => {
                  const meta = statusMeta(request.status);

                  return (
                    <div key={request.id} className="rounded-xl border px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          className="flex-1 space-y-1 text-left"
                          onClick={() => setSelectedRequest(request)}
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={meta.className}>
                              {meta.label}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              提交于 {formatDateTime(request.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {request.reviewed_at ? `审核于 ${formatDateTime(request.reviewed_at)}` : "尚未审核"}
                          </p>
                        </button>

                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setSelectedRequest(request)}>
                            查看详情
                          </Button>
                          {request.status === "pending" ? (
                            <form action={withdrawMyDraftAction}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <WithdrawButton />
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </AppDialogShell>
      </Dialog>

      <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <AppDialogShell
          title="变更详情"
          description="这里展示该次提交的具体字段内容与审核结果。"
          contentClassName="sm:max-w-3xl"
          bodyClassName="space-y-6"
        >
          {selectedRequest ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusMeta(selectedRequest.status).className}>
                  {statusMeta(selectedRequest.status).label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  提交于 {formatDateTime(selectedRequest.created_at)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {selectedRequest.reviewed_at ? `审核于 ${formatDateTime(selectedRequest.reviewed_at)}` : "尚未审核"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <div key={field} className="space-y-2 rounded-lg border bg-muted/10 px-4 py-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <div className="text-sm">
                      {renderFieldValue(field as DraftEditableField, selectedRequest.payload[field as DraftEditableField])}
                    </div>
                  </div>
                ))}
              </div>

              {selectedRequest.review_comment ? (
                <div className="rounded-lg border border-stone-200/80 bg-stone-50/70 px-4 py-3 text-sm text-stone-700 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-300">
                  审核备注：{selectedRequest.review_comment}
                </div>
              ) : null}
            </>
          ) : null}
        </AppDialogShell>
      </Dialog>
    </>
  );
}
