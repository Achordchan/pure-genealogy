"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyPhoneAction } from "./actions";

export function PhoneEditor({
  phone,
  error,
  success,
}: {
  phone: string | null;
  error?: string;
  success?: string;
}) {
  const [isEditing, setIsEditing] = useState(Boolean(error));

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">手机号</p>
          {!isEditing ? <p className="font-medium">{phone || "未填写"}</p> : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant={phone ? "outline" : "default"}
          onClick={() => setIsEditing((value) => !value)}
        >
          {isEditing ? "取消编辑" : phone ? "修改手机号" : "填写手机号"}
        </Button>
      </div>

      {isEditing && (
        <form action={updateMyPhoneAction} className="space-y-3 border-t pt-3">
          <div className="space-y-2">
            <Label htmlFor="phone" className="sr-only">
              手机号
            </Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                defaultValue={phone ?? ""}
                placeholder="请输入11位手机号"
                required
                className="sm:flex-1"
              />
              <Button type="submit" size="sm" className="sm:shrink-0">
                保存
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{decodeURIComponent(error)}</p>}
          {success && <p className="text-sm text-emerald-600">{decodeURIComponent(success)}</p>}
        </form>
      )}
    </div>
  );
}
