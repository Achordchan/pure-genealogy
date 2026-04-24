"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { MapPinned, Phone, Route, ScrollText, X } from "lucide-react";

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
import { buildAmapNavigationUrl, type RitualDetail } from "@/lib/rituals/shared";

const AMapPreview = dynamic(() => import("./amap-preview").then((mod) => mod.AMapPreview), {
  ssr: false,
});

function FieldItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg border border-stone-100 bg-stone-50/70 p-3 dark:border-stone-700 dark:bg-stone-800/50">
      <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-stone-800 dark:text-stone-200">{value || "未填写"}</p>
    </div>
  );
}

function TextBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-stone-100 bg-stone-50/50 p-4 dark:border-stone-800 dark:bg-stone-900/50">
      <div className="flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        <h3 className="font-serif text-base font-bold text-stone-800 dark:text-stone-100">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function RitualDetailDrawer({
  detail,
  open,
  isLoading,
  onOpenChange,
}: {
  detail: RitualDetail | null;
  open: boolean;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigationUrl = useMemo(() => (detail ? buildAmapNavigationUrl(detail) : null), [detail]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("memberId");
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(null, "", nextUrl);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-auto max-w-none border-none bg-transparent p-0 shadow-none duration-300 sm:max-w-none"
        aria-describedby={undefined}
        showCloseButton={false}
      >
        <div className="relative max-h-[88dvh] w-[94vw] max-w-[760px] overflow-hidden rounded-lg border-2 border-double border-stone-200 bg-[#fdfbf7] shadow-2xl dark:border-stone-700 dark:bg-stone-900">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="absolute right-4 top-4 z-20 rounded-full border border-stone-200/80 bg-background/85 p-1.5 text-stone-500 transition hover:text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-primary/40 dark:border-stone-700/80 dark:bg-stone-950/85 dark:text-stone-400 dark:hover:text-stone-100"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>

          <DialogHeader className="border-b border-stone-200 bg-stone-100/50 p-5 pr-14 dark:border-stone-700 dark:bg-stone-800/50 sm:p-6 sm:pr-16">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <MapPinned className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="font-serif text-2xl font-bold text-stone-800 dark:text-stone-100">
                    {detail?.name ?? "祭祀详情"}
                  </DialogTitle>
                  <Badge variant="outline" className="font-serif text-xs">祭祀</Badge>
                </div>
                <DialogDescription className="font-serif text-xs text-stone-500 dark:text-stone-400">
                  {detail?.generation !== null && detail?.generation !== undefined ? `第 ${detail.generation} 世` : "世代未录入"}
                  {detail?.father_name ? ` · 父亲：${detail.father_name}` : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(88dvh-104px)] overflow-y-auto p-4 font-serif scrollbar-thin scrollbar-thumb-stone-200 dark:scrollbar-thumb-stone-700 sm:p-6">
            {isLoading ? (
              <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/60 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-800/40">
                正在加载祭祀详情...
              </div>
            ) : !detail ? (
              <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/60 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-800/40">
                暂无可展示的祭祀成员
              </div>
            ) : !detail.ritual ? (
              <div className="space-y-3 rounded-lg border border-dashed border-stone-200 bg-stone-50/60 px-4 py-8 dark:border-stone-700 dark:bg-stone-800/40">
                <p className="text-lg font-bold text-stone-800 dark:text-stone-100">{detail.name}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">当前还没有录入祭祀信息。</p>
              </div>
            ) : (
              <div className="space-y-4">
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MapPinned className="h-4 w-4 text-stone-500" />
                      <h3 className="font-serif text-base font-bold text-stone-800 dark:text-stone-100">墓地位置</h3>
                    </div>
                    {navigationUrl ? (
                      <Button asChild size="sm">
                        <a href={navigationUrl} target="_blank" rel="noreferrer">打开导航</a>
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldItem label="墓园名称" value={detail.ritual.cemetery_name} />
                    <FieldItem label="墓位摘要" value={[detail.ritual.area_block, detail.ritual.plot_number].filter(Boolean).join(" · ")} />
                    <FieldItem label="详细地址" value={detail.ritual.address} />
                    <FieldItem label="联系人" value={detail.ritual.contact_name} />
                    <FieldItem label="联系电话" value={detail.ritual.contact_phone} />
                  </div>
                </section>

                <section className="space-y-3 rounded-lg border border-stone-100 bg-stone-50/50 p-4 dark:border-stone-800 dark:bg-stone-900/50">
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-stone-500" />
                    <h3 className="font-serif text-base font-bold text-stone-800 dark:text-stone-100">地图导航</h3>
                  </div>
                  <AMapPreview latitude={detail.ritual.latitude} longitude={detail.ritual.longitude} />
                </section>

                <TextBlock title="到场指引">
                  {detail.ritual.guide_text ? <RichTextViewer value={detail.ritual.guide_text} /> : <p className="text-sm text-stone-500">暂无到场指引</p>}
                </TextBlock>

                <TextBlock title="祭扫说明">
                  {detail.ritual.ritual_notes ? <RichTextViewer value={detail.ritual.ritual_notes} /> : <p className="text-sm text-stone-500">暂无祭扫说明</p>}
                </TextBlock>

                <section className="rounded-lg border border-stone-100 bg-stone-50/50 p-4 dark:border-stone-800 dark:bg-stone-900/50">
                  <div className="mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-stone-500" />
                    <h3 className="font-serif text-base font-bold text-stone-800 dark:text-stone-100">祭祀附件</h3>
                  </div>
                  <MemberAssetsPanel memberId={detail.member_id} canUpload={false} assetScope="ritual" />
                </section>
              </div>
            )}
          </div>

          {detail?.ritual && navigationUrl ? (
            <div className="border-t border-stone-200 bg-[#fdfbf7]/95 p-3 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 sm:hidden">
              <Button asChild className="h-12 w-full">
                <a href={navigationUrl} target="_blank" rel="noreferrer">
                  <MapPinned className="mr-2 h-4 w-4" />
                  导航到墓地
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
