"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { AppDialogShell } from "@/components/app-dialog-shell";
import { ProfileDraftEditor } from "./profile-draft-editor";
import { MemberChangeHistoryDialog } from "./member-change-history-dialog";
import type { DraftEditableField, MemberChangeRequest } from "@/lib/account/shared";

interface MemberProfileCardProps {
  member: {
    name: string;
    generation: number | null;
    sibling_order: number | null;
    fatherName: string | null;
    inferredMotherName: string | null;
    spouse: string | null;
    residence_place: string | null;
    official_position: string | null;
    gender: "男" | "女" | null;
    is_alive: boolean;
    birthday: string | null;
    death_date: string | null;
    remarks: string | null;
  };
  pendingPayload?: Partial<Record<DraftEditableField, string | null>>;
  hasPendingRequest: boolean;
  historyRequests: MemberChangeRequest[];
  canEdit: boolean;
  error?: string;
  success?: string;
  historyError?: string;
  historySuccess?: string;
}

export function MemberProfileCard({
  member,
  pendingPayload,
  hasPendingRequest,
  historyRequests,
  canEdit,
  error,
  success,
  historyError,
  historySuccess,
}: MemberProfileCardProps) {
  const [isEditing, setIsEditing] = useState(Boolean(error) || Boolean(success));
  const [isHistoryOpen, setIsHistoryOpen] = useState(Boolean(historyError) || Boolean(historySuccess));
  const editFormId = "member-profile-draft-form";

  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <CardTitle>绑定成员</CardTitle>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setIsHistoryOpen(true)}>
                变更历史
              </Button>
              <Button type="button" size="sm" onClick={() => setIsEditing(true)}>
                编辑资料
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <p>姓名：{member.name}</p>
          <p>世代：{member.generation ? `第${member.generation}世` : "未填写"}</p>
          <p>排行：{member.sibling_order ?? "未填写"}</p>
          <p>父亲：{member.fatherName || "未录入"}</p>
          <p>母亲：{member.inferredMotherName || "未录入"}</p>
          <p>性别：{member.gender || "未填写"}</p>
          <p>在世状态：{member.is_alive ? "在世" : "已故"}</p>
          <p>生日：{member.birthday || "未填写"}</p>
          <p>配偶：{member.spouse || "未填写"}</p>
          <p>居住地：{member.residence_place || "未填写"}</p>
          <p className="sm:col-span-2">官职：{member.official_position || "未填写"}</p>
        </CardContent>
      </Card>

      <Dialog open={canEdit && isEditing} onOpenChange={setIsEditing}>
        <AppDialogShell
          title="编辑资料"
          description="这里提交的内容需要管理员或编辑员审核通过后才会生效。"
          contentClassName="sm:max-w-3xl"
          bodyClassName="space-y-4"
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                取消
              </Button>
              <Button type="submit" form={editFormId}>
                保存并提交审核
              </Button>
            </>
          }
        >
          <ProfileDraftEditor
            member={{
              name: member.name,
              spouse: member.spouse,
              birthday: member.birthday,
              gender: member.gender,
              is_alive: member.is_alive,
              death_date: member.death_date,
              residence_place: member.residence_place,
              official_position: member.official_position,
              remarks: member.remarks,
            }}
            pendingPayload={pendingPayload}
            hasPendingRequest={hasPendingRequest}
            error={error}
            success={success}
            embedded
            formId={editFormId}
            showSubmitButton={false}
          />
        </AppDialogShell>
      </Dialog>

      {canEdit ? (
        <MemberChangeHistoryDialog
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          publishedValues={{
            spouse: member.spouse,
            birthday: member.birthday,
            gender: member.gender,
            is_alive: member.is_alive ? "true" : "false",
            death_date: member.death_date,
            residence_place: member.residence_place,
            official_position: member.official_position,
            remarks: member.remarks,
          }}
          requests={historyRequests}
          error={historyError}
          success={historySuccess}
        />
      ) : null}
    </>
  );
}
