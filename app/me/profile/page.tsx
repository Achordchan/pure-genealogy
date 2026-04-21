import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyProfileContext } from "../actions";
import { PhoneEditor } from "../phone-editor";

const ROLE_LABELS = {
  admin: "管理员",
  editor: "编辑员",
  member: "普通用户",
} as const;

async function MyProfileContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await connection();
  const { profile, member } = await getMyProfileContext();
  const params = await searchParams;

  if (!profile) {
    redirect("/auth/login");
  }

  return (
    <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>账号资料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>姓名：{profile.real_name}</p>
          <p>角色：{ROLE_LABELS[profile.role]}</p>
          <p>状态：{profile.status === "approved" ? "已通过" : profile.status === "pending" ? "待审核" : "已拒绝"}</p>
          <p>身份证号：{profile.id_card_masked}</p>
          <PhoneEditor phone={profile.phone} error={params.error} success={params.success} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>绑定成员</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {member ? (
            <>
              <p>姓名：{String(member.name)}</p>
              <p>世代：{member.generation ? `第${member.generation}世` : "未填写"}</p>
              <p>配偶：{String(member.spouse || "未填写")}</p>
              <p>居住地：{String(member.residence_place || "未填写")}</p>
              <p>官职：{String(member.official_position || "未填写")}</p>
            </>
          ) : (
            <p className="text-muted-foreground">当前账号尚未绑定族谱成员，请联系管理员处理。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  return (
    <Suspense fallback={<div className="container mx-auto h-64 px-4 py-8" />}>
      <MyProfileContent searchParams={searchParams} />
    </Suspense>
  );
}
