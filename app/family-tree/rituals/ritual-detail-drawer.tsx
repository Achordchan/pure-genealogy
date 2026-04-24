"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPinned, Phone, Route, ScrollText } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichTextViewer } from "@/components/rich-text/viewer";
import { MemberAssetsPanel } from "@/app/family-tree/member-assets-panel";
import { AMapPreview } from "./amap-preview";
import { buildAmapNavigationUrl, RitualDetail } from "@/lib/rituals/shared";

function FieldItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1 rounded-xl border bg-background/70 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "未填写"}</p>
    </div>
  );
}

export function RitualDetailDrawer({
  detail,
  open,
}: {
  detail: RitualDetail | null;
  open: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigationUrl = useMemo(() => (detail ? buildAmapNavigationUrl(detail) : null), [detail]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("memberId");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="left-auto right-0 top-0 h-full w-full max-w-full translate-x-0 translate-y-0 rounded-none border-l border-stone-200/90 p-0 sm:w-[640px] dark:border-stone-700/90"
        showCloseButton
      >
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <Badge variant="outline">祭祀</Badge>
            <div>
              <DialogTitle>{detail?.name ?? "祭祀详情"}</DialogTitle>
              <DialogDescription>
                {detail?.generation ? `第${detail.generation}世` : "世代未录入"}
                {detail?.father_name ? ` · 父亲：${detail.father_name}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="h-[calc(100vh-88px)] space-y-6 overflow-y-auto px-6 py-5">
          {!detail ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              暂无可展示的祭祀成员
            </div>
          ) : !detail.ritual ? (
            <div className="space-y-4 rounded-xl border border-dashed bg-muted/20 px-4 py-8">
              <p className="text-base font-medium">{detail.name}</p>
              <p className="text-sm text-muted-foreground">当前还没有录入祭祀信息。</p>
            </div>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-medium">基本位置</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldItem label="墓园名称" value={detail.ritual.cemetery_name} />
                  <FieldItem label="墓位摘要" value={[detail.ritual.area_block, detail.ritual.plot_number].filter(Boolean).join(" · ")} />
                  <FieldItem label="详细地址" value={detail.ritual.address} />
                  <FieldItem label="联系人" value={detail.ritual.contact_name} />
                  <FieldItem label="联系电话" value={detail.ritual.contact_phone} />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-base font-medium">地图导航</h3>
                  </div>
                  {navigationUrl ? (
                    <Button asChild size="sm">
                      <a href={navigationUrl} target="_blank" rel="noreferrer">
                        一键导航
                      </a>
                    </Button>
                  ) : null}
                </div>
                <AMapPreview
                  latitude={detail.ritual.latitude}
                  longitude={detail.ritual.longitude}
                />
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-medium">到场指引</h3>
                </div>
                <div className="rounded-xl border bg-background/70 p-4">
                  {detail.ritual.guide_text ? (
                    <RichTextViewer value={detail.ritual.guide_text} />
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无到场指引</p>
                  )}
                </div>
                <MemberAssetsPanel memberId={detail.member_id} canUpload={false} assetScope="ritual" />
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-base font-medium">祭扫说明</h3>
                </div>
                <div className="rounded-xl border bg-background/70 p-4">
                  {detail.ritual.ritual_notes ? (
                    <RichTextViewer value={detail.ritual.ritual_notes} />
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无祭扫说明</p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
