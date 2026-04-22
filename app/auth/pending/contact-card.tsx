"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SavePhoneButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="shrink-0" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {pending ? "保存中..." : "提交手机号"}
    </Button>
  );
}

interface PendingContactCardProps {
  currentPhone: string | null;
  draftPhone?: string;
  hasActionError?: boolean;
  action: (formData: FormData) => void | Promise<void>;
}

export function PendingContactCard({
  currentPhone,
  draftPhone,
  hasActionError,
  action,
}: PendingContactCardProps) {
  const defaultValue = useMemo(() => draftPhone ?? currentPhone ?? "", [currentPhone, draftPhone]);
  const [isEditing, setIsEditing] = useState(!currentPhone || Boolean(hasActionError));

  return (
    <Card className="border-stone-200/80 bg-background/80 dark:border-stone-800">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">联系方式</CardTitle>
            <CardDescription>
              手机号仅用于管理员联系你核对信息，不作为登录账号。
            </CardDescription>
          </div>
          {currentPhone ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing((value) => !value)}
              className="gap-2"
            >
              <PencilLine className="h-4 w-4" />
              {isEditing ? "取消编辑" : "修改手机号"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <form action={action} className="space-y-4">
            <div className="rounded-lg border border-stone-200/80 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-sm text-muted-foreground">
                  当前联系方式
                </Label>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-center">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    defaultValue={defaultValue}
                    placeholder="请输入11位手机号"
                    required
                    className="w-full text-lg font-medium"
                  />
                  <SavePhoneButton />
                </div>
                <p className="text-xs text-muted-foreground">请输入 11 位中国大陆手机号</p>
              </div>
            </div>
          </form>
        ) : (
          <>
            <div className="rounded-lg border border-stone-200/80 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
              <div className="text-sm text-muted-foreground">当前联系方式</div>
              <div className="mt-2 text-lg font-medium text-foreground">
                {currentPhone || "未填写手机号"}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
