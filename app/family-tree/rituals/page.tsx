import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { MapPinned, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentAccountProfile } from "@/lib/account/server";
import { canViewRituals } from "@/lib/account/shared";
import { buildAmapNavigationUrlForTarget, formatRitualLocation } from "@/lib/rituals/shared";
import { getMemberRitualByMemberId, searchRitualMembers } from "../ritual-actions";
import { RitualDetailDrawer } from "./ritual-detail-drawer";

export default async function RitualsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; generation?: string; memberId?: string }>;
}) {
  await connection();
  const profile = await getCurrentAccountProfile();
  const params = await searchParams;

  if (!profile) {
    redirect("/auth/login");
  }

  if (!canViewRituals(profile)) {
    redirect("/auth/pending");
  }

  const keyword = params.q?.trim() ?? "";
  const generationNumber = params.generation ? Number(params.generation) : null;
  const memberIdNumber = params.memberId ? Number(params.memberId) : null;
  const generation = Number.isFinite(generationNumber) ? generationNumber : null;
  const selectedMemberId = Number.isFinite(memberIdNumber) ? memberIdNumber : null;

  const [{ items, generations }, selectedDetail] = await Promise.all([
    searchRitualMembers({ keyword, generation }),
    selectedMemberId ? getMemberRitualByMemberId(selectedMemberId) : Promise.resolve(null),
  ]);

  const generationOptions = [{ label: "全部世代", value: "all" }].concat(
    generations.map((item) => ({ label: `第${item}世`, value: String(item) })),
  );

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">祭祀</h1>
        <p className="text-sm text-muted-foreground">集中查询已故成员的墓位、路线指引与祭扫说明。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>检索</CardTitle>
          <CardDescription>按姓名、墓园、地址或墓位信息查找祭祀资料。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-center" action="/family-tree/rituals">
            <Input
              name="q"
              defaultValue={keyword}
              placeholder="搜索姓名、墓园、地址、墓位号"
              className="sm:max-w-md"
            />
            <select
              name="generation"
              defaultValue={generation ? String(generation) : "all"}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-40"
            >
              {generationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已故成员</CardTitle>
          <CardDescription>优先按“找人”效率展示，详情与导航都从这里进入。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              当前没有匹配的祭祀成员
            </div>
          ) : (
            items.map((item) => {
              const detailHref = `/family-tree/rituals?${new URLSearchParams({
                ...(keyword ? { q: keyword } : {}),
                ...(generation ? { generation: String(generation) } : {}),
                memberId: String(item.member_id),
              }).toString()}`;
              const navigationUrl = item.ritual
                ? buildAmapNavigationUrlForTarget(item.name, item.ritual)
                : null;

              return (
                <div key={item.member_id} className="flex flex-col gap-4 rounded-xl border bg-background/80 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-medium">{item.name}</p>
                      {item.generation !== null ? <span className="text-xs text-muted-foreground">第{item.generation}世</span> : null}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>父亲/支系：{item.father_name || "未录入"}</p>
                      <p>墓园与墓位：{formatRitualLocation(item.ritual)}</p>
                      <p>地址摘要：{item.ritual?.address || "暂无祭祀信息"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <Link href={detailHref}>查看详情</Link>
                    </Button>
                    {navigationUrl ? (
                      <Button asChild>
                        <a href={navigationUrl} target="_blank" rel="noreferrer">
                          <MapPinned className="mr-2 h-4 w-4" />
                          导航
                        </a>
                      </Button>
                    ) : (
                      <Button disabled>
                        <MapPinned className="mr-2 h-4 w-4" />
                        导航
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <RitualDetailDrawer detail={selectedDetail} open={Boolean(selectedMemberId)} />
    </div>
  );
}
