import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Clock3, IdCard, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlashToast } from "@/components/flash-toast";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentPendingProfile, updatePendingPhoneAction } from "../actions";
import { consumeFlashMessage, consumePendingPhoneDraft } from "@/lib/flash";
import { getAccountHomePath, getPendingStatusText } from "@/lib/account/shared";
import { PendingContactCard } from "./contact-card";
import { PendingStatusListener } from "./pending-status-listener";

async function PendingContent() {
  await connection();
  const profile = await getCurrentPendingProfile();
  const flash = await consumeFlashMessage();
  const draftPhone = await consumePendingPhoneDraft();

  if (!profile) {
    redirect("/auth/login");
  }

  if (profile.status === "approved") {
    redirect(getAccountHomePath(profile));
  }

  return (
    <Card className="border-stone-200/80 bg-background/90 shadow-xl dark:border-stone-800 dark:bg-stone-950/90">
      <FlashToast flash={flash} />
      <PendingStatusListener profileId={profile.id} homePath={getAccountHomePath(profile)} />
      <CardHeader className="space-y-4 border-b border-stone-200/80 pb-6 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            待审核
          </Badge>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            通常在 1 个工作日内完成审核
          </div>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-3xl">信息正在审核中</CardTitle>
          <CardDescription className="text-base leading-7">
            {getPendingStatusText(profile.status)}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <Card className="border-stone-200/80 bg-background/80 dark:border-stone-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">审核信息</CardTitle>
            <CardDescription>以下信息已提交给管理员，用于完成身份核验。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-stone-200/80 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserRound className="h-4 w-4" />
                姓名
              </div>
              <div className="mt-2 text-lg font-medium">{profile.real_name}</div>
            </div>
            <div className="rounded-lg border border-stone-200/80 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IdCard className="h-4 w-4" />
                身份证号
              </div>
              <div className="mt-2 text-lg font-medium">{profile.id_card_masked}</div>
            </div>
          </CardContent>
        </Card>

        <PendingContactCard
          currentPhone={profile.phone}
          draftPhone={draftPhone ?? undefined}
          hasActionError={flash?.type === "error"}
          action={updatePendingPhoneAction}
        />

        <div className="flex justify-end">
          <LogoutButton className="min-w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PendingPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-3xl">
        <Suspense fallback={<div className="h-80 rounded-xl border bg-background/70" />}>
          <PendingContent />
        </Suspense>
      </div>
    </div>
  );
}
