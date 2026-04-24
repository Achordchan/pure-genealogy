import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { MapPinned, Search, Route, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentAccountProfile } from "@/lib/account/server";
import { canViewRituals } from "@/lib/account/shared";
import { buildAmapNavigationUrlForTarget, formatRitualLocation, type RitualSearchItem } from "@/lib/rituals/shared";
import { getMemberRitualByMemberId, searchRitualMembers } from "../ritual-actions";
import { RitualDetailController } from "./ritual-detail-controller";
import { RitualDetailLink } from "./ritual-detail-link";

export default async function RitualsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; generation?: string; memberId?: string; showAll?: string }>;
}) {
  await connection();
  const profile = await getCurrentAccountProfile();
  const params = await searchParams;

  if (!profile) redirect("/auth/login");
  if (!canViewRituals(profile)) redirect("/auth/pending");

  const keyword = params.q?.trim() ?? "";
  const generationNumber = params.generation ? Number(params.generation) : null;
  const memberIdNumber = params.memberId ? Number(params.memberId) : null;
  const generation = Number.isFinite(generationNumber) ? generationNumber : null;
  const selectedMemberId = Number.isFinite(memberIdNumber) ? memberIdNumber : null;
  const shouldShowResults = Boolean(keyword || generation || params.showAll === "1" || selectedMemberId);

  const [{ items, generations }, selectedDetail] = await Promise.all([
    searchRitualMembers({ keyword, generation }),
    selectedMemberId ? getMemberRitualByMemberId(selectedMemberId) : Promise.resolve(null),
  ]);

  const generationOptions = [{ label: "全部世代", value: "all" }].concat(
    generations.map((item) => ({ label: `第${item}世`, value: String(item) })),
  );

  return (
    <div className="container mx-auto space-y-5 px-4 py-5 sm:space-y-6 sm:py-8">
      <section className="overflow-hidden rounded-3xl border border-stone-200/80 bg-gradient-to-br from-stone-50 via-background to-emerald-50/40 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">祭祀</h1>
          </div>

          <form className="grid gap-3 rounded-2xl border bg-background/90 p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_150px_auto_auto] lg:min-w-[720px]" action="/family-tree/rituals">
            <Input name="q" defaultValue={keyword} placeholder="搜索姓名、墓园、地址、墓位号" className="h-11" />
            <select
              name="generation"
              defaultValue={generation ? String(generation) : "all"}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {generationOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button type="submit" className="h-11">
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/family-tree/rituals?showAll=1">加载全部</Link>
            </Button>
          </form>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-stone-50/60">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>已故成员</CardTitle>
              <CardDescription>{shouldShowResults ? `共 ${items.length} 位` : "搜索后显示结果"}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-5">
          {!shouldShowResults ? (
            <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
              搜索成员，或点击“加载全部”。
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
              当前没有匹配的祭祀成员
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((item) => (
                <RitualMemberCard
                  key={item.member_id}
                  item={item}
                  keyword={keyword}
                  generation={generation}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RitualDetailController initialDetail={selectedDetail} initialOpen={!!selectedMemberId} />
    </div>
  );
}

function RitualMemberCard({
  item,
  keyword,
  generation,
}: {
  item: RitualSearchItem;
  keyword: string;
  generation: number | null;
}) {
  const detailHref = `/family-tree/rituals?${new URLSearchParams({
    ...(keyword ? { q: keyword } : {}),
    ...(generation ? { generation: String(generation) } : {}),
    ...(!keyword && !generation ? { showAll: "1" } : {}),
    memberId: String(item.member_id),
  }).toString()}`;
  const navigationUrl = item.ritual ? buildAmapNavigationUrlForTarget(item.name, item.ritual) : null;

  return (
    <article className="group rounded-2xl border bg-background p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-xl font-semibold leading-none">{item.name}</h2>
              {item.generation !== null ? (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">第{item.generation}世</span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">父亲/支系：{item.father_name || "未录入"}</p>
          </div>
          <span className="shrink-0 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
            {item.ritual ? "已录入" : "待完善"}
          </span>
        </div>

        <div className="grid gap-2 text-sm">
          <InfoLine icon={<MapPinned className="h-4 w-4" />} label="墓位" value={formatRitualLocation(item.ritual)} />
          <InfoLine icon={<Route className="h-4 w-4" />} label="地址" value={item.ritual?.address || "暂无祭祀信息"} />
          <InfoLine icon={<ScrollText className="h-4 w-4" />} label="配偶" value={item.spouse || "未录入"} />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button asChild variant="outline" className="h-11">
            <RitualDetailLink href={detailHref} memberId={item.member_id}>查看详情</RitualDetailLink>
          </Button>
          {navigationUrl ? (
            <Button asChild className="h-11">
              <a href={navigationUrl} target="_blank" rel="noreferrer">
                <MapPinned className="mr-2 h-4 w-4" />
                导航
              </a>
            </Button>
          ) : (
            <Button disabled className="h-11">
              <MapPinned className="mr-2 h-4 w-4" />
              导航
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-2 rounded-xl bg-stone-50/70 px-3 py-2 text-stone-700">
      <span className="mt-0.5 text-primary">{icon}</span>
      <p className="min-w-0 flex-1 truncate">
        <span className="text-muted-foreground">{label}：</span>{value}
      </p>
    </div>
  );
}
