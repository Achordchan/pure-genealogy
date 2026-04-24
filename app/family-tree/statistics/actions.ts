"use server";

import { requireApprovedAccount } from "@/lib/account/server";
import { fetchApiFamilyMembers } from "@/lib/api/family";

export interface StatisticsData {
  totalMembers: number;
  genderStats: { name: string; value: number; fill: string }[];
  generationStats: { name: string; value: number }[];
  statusStats: { name: string; value: number; fill: string }[];
  ageStats: { name: string; value: number }[];
  commonNames: { name: string; count: number }[];
}

export async function fetchFamilyStatistics(): Promise<{
  data: StatisticsData | null;
  error: string | null;
}> {
  try {
    await requireApprovedAccount();
    const { items: members } = await fetchApiFamilyMembers();

    const genderCounts = countBy(members, (member) => member.gender || "未知");
    const generationCounts = countBy(members, (member) => (member.generation ? `第${member.generation}世` : "未知"));
    const statusCounts = countBy(members, (member) => (member.is_alive ? "在世" : "已故"));
    const nameCounts = countBy(members.filter((member) => member.name.length >= 2), (member) => member.name[1]);

    return {
      data: {
        totalMembers: members.length,
        genderStats: [
          { name: "男", value: genderCounts["男"] || 0, fill: "#3b82f6" },
          { name: "女", value: genderCounts["女"] || 0, fill: "#ec4899" },
          ...(genderCounts["未知"] ? [{ name: "未知", value: genderCounts["未知"], fill: "#94a3b8" }] : []),
        ],
        generationStats: Object.entries(generationCounts)
          .sort(([left], [right]) => sortGenerationLabel(left, right))
          .map(([name, value]) => ({ name, value })),
        statusStats: [
          { name: "在世", value: statusCounts["在世"] || 0, fill: "#22c55e" },
          { name: "已故", value: statusCounts["已故"] || 0, fill: "#64748b" },
        ],
        ageStats: buildAgeStats(members),
        commonNames: Object.entries(nameCounts)
          .sort(([, left], [, right]) => right - left)
          .slice(0, 10)
          .map(([name, count]) => ({ name, count })),
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "读取统计失败" };
  }
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function sortGenerationLabel(left: string, right: string) {
  if (left === "未知") return 1;
  if (right === "未知") return -1;
  return Number(left.replace(/\D/g, "")) - Number(right.replace(/\D/g, ""));
}

function buildAgeStats(members: { is_alive: boolean; birthday: string | null }[]) {
  const groups: Record<string, number> = {
    "0-10岁": 0,
    "11-20岁": 0,
    "21-30岁": 0,
    "31-40岁": 0,
    "41-50岁": 0,
    "51-60岁": 0,
    "61-70岁": 0,
    "71-80岁": 0,
    "80岁以上": 0,
  };
  const now = new Date();

  members.forEach((member) => {
    if (!member.is_alive || !member.birthday) return;
    const birthday = new Date(member.birthday);
    let age = now.getFullYear() - birthday.getFullYear();
    const monthDiff = now.getMonth() - birthday.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthday.getDate())) age--;
    if (age <= 10) groups["0-10岁"]++;
    else if (age <= 20) groups["11-20岁"]++;
    else if (age <= 30) groups["21-30岁"]++;
    else if (age <= 40) groups["31-40岁"]++;
    else if (age <= 50) groups["41-50岁"]++;
    else if (age <= 60) groups["51-60岁"]++;
    else if (age <= 70) groups["61-70岁"]++;
    else if (age <= 80) groups["71-80岁"]++;
    else groups["80岁以上"]++;
  });

  return Object.entries(groups).map(([name, value]) => ({ name, value }));
}
