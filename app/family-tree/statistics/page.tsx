import React, { Suspense } from "react";
import { StatisticsContent } from "./statistics-content";
import { FAMILY_SURNAME } from "@/lib/utils";

export const metadata = {
  title: `${FAMILY_SURNAME}氏统计分析`,
  description: `${FAMILY_SURNAME}氏家族成员数据统计仪表盘`,
};

export default function StatisticsPage() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-3xl font-bold">家族数据统计</h1>
        <p className="text-muted-foreground">
          家族成员数据分析仪表盘
        </p>
      </div>
      
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground">正在加载统计数据...</div>}>
        <StatisticsContent />
      </Suspense>
    </div>
  );
}
