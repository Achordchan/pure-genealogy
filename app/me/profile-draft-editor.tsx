"use client";

import { useState } from "react";
import { RichTextEditor } from "@/components/rich-text/editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitMyDraftAction } from "./actions";
import type { DraftEditableField } from "@/lib/account/shared";
import { cn } from "@/lib/utils";

interface ProfileDraftEditorProps {
  member: {
    name: string;
    spouse: string | null;
    birthday: string | null;
    gender: "男" | "女" | null;
    is_alive: boolean;
    death_date: string | null;
    residence_place: string | null;
    official_position: string | null;
    remarks: string | null;
  };
  pendingPayload?: Partial<Record<DraftEditableField, string | null>>;
  hasPendingRequest: boolean;
  error?: string;
  success?: string;
  embedded?: boolean;
  formId?: string;
  showSubmitButton?: boolean;
}

function pickDraftValue(
  pendingValue: string | null | undefined,
  currentValue: unknown,
) {
  if (pendingValue !== undefined) {
    return pendingValue ?? "";
  }

  return typeof currentValue === "string" ? currentValue : "";
}

export function ProfileDraftEditor({
  member,
  pendingPayload,
  hasPendingRequest,
  error,
  success,
  embedded = false,
  formId,
  showSubmitButton = true,
}: ProfileDraftEditorProps) {
  const payload = pendingPayload ?? {};
  const [remarks, setRemarks] = useState(() =>
    pickDraftValue(payload.remarks, member.remarks),
  );
  const [gender, setGender] = useState(() =>
    pickDraftValue(payload.gender, member.gender),
  );
  const [aliveStatus, setAliveStatus] = useState(() =>
    pickDraftValue(payload.is_alive, member.is_alive ? "true" : "false") || "true",
  );

  const form = (
    <form id={formId} action={submitMyDraftAction} className="space-y-5">
      <div className={cn("space-y-1 text-sm text-muted-foreground", embedded && "mb-5")}>
        <p>当前绑定成员：{member.name}</p>
        <p>{hasPendingRequest ? "你已有一份待审核草稿，再次提交会覆盖原草稿。" : "提交后由管理员或编辑员审核通过。"}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="gender">性别</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger id="gender">
              <SelectValue placeholder="选择性别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="男">男</SelectItem>
              <SelectItem value="女">女</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="gender" value={gender} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="spouse">配偶</Label>
          <Input
            id="spouse"
            name="spouse"
            defaultValue={pickDraftValue(payload.spouse, member.spouse)}
          />
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
          <Label htmlFor="is_alive">在世状态</Label>
          <Select value={aliveStatus} onValueChange={setAliveStatus}>
            <SelectTrigger id="is_alive">
              <SelectValue placeholder="选择在世状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">在世</SelectItem>
              <SelectItem value="false">已故</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="is_alive" value={aliveStatus} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="residence_place">居住地</Label>
          <Input
            id="residence_place"
            name="residence_place"
            defaultValue={pickDraftValue(payload.residence_place, member.residence_place)}
          />
        </div>
        {aliveStatus === "false" ? (
          <div className="grid gap-2">
            <Label htmlFor="death_date">离世日期</Label>
            <Input
              id="death_date"
              name="death_date"
              type="date"
              defaultValue={pickDraftValue(payload.death_date, member.death_date)}
            />
          </div>
        ) : (
          <input type="hidden" name="death_date" value="" />
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="remarks-editor">生平事迹</Label>
        <RichTextEditor
          value={remarks}
          onChange={setRemarks}
          maxLength={500}
          className="bg-background"
        />
        <input type="hidden" name="remarks" value={remarks} />
      </div>

      {error ? <p className="text-sm text-red-500">{decodeURIComponent(error)}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{decodeURIComponent(success)}</p> : null}

      {showSubmitButton ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit">保存并提交审核</Button>
        </div>
      ) : null}
    </form>
  );

  if (embedded) {
    return form;
  }

  return <div className="rounded-xl border bg-card p-6 shadow">{form}</div>;
}
