import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyProfileContext } from "../actions";
import { PhoneEditor } from "../phone-editor";
import { canSubmitOwnDraft } from "@/lib/account/shared";
import { MemberProfileCard } from "../member-profile-card";

const ROLE_LABELS = {
  admin: "管理员",
  editor: "编辑员",
  member: "普通用户",
} as const;

async function MyProfileContent({
  searchParams,
}: {
  searchParams: Promise<{
    phoneError?: string;
    phoneSuccess?: string;
    draftError?: string;
    draftSuccess?: string;
    historyError?: string;
    historySuccess?: string;
  }>;
}) {
  await connection();
  const {
    profile,
    member,
    pendingRequest,
    historyRequests,
    fatherName,
    inferredMotherName,
  } = await getMyProfileContext();
  const params = await searchParams;

  if (!profile) {
    redirect("/auth/login");
  }

  return (
    <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-2 lg:items-stretch">
      <Card className="h-full">
        <CardHeader>
          <CardTitle>账号资料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>姓名：{profile.real_name}</p>
          <p>角色：{ROLE_LABELS[profile.role]}</p>
          <p>状态：{profile.status === "approved" ? "已通过" : profile.status === "pending" ? "待审核" : "已拒绝"}</p>
          <p>身份证号：{profile.id_card_masked}</p>
          <PhoneEditor
            phone={profile.phone}
            error={params.phoneError}
            success={params.phoneSuccess}
          />
        </CardContent>
      </Card>

      {member ? (
        <MemberProfileCard
          member={{
            name: String(member.name),
            generation: member.generation,
            sibling_order: member.sibling_order,
            fatherName,
            inferredMotherName,
            spouse: member.spouse,
            residence_place: member.residence_place,
            official_position: member.official_position,
            gender: member.gender,
            is_alive: member.is_alive,
            birthday: member.birthday,
            death_date: member.death_date,
            remarks: member.remarks,
          }}
          pendingPayload={pendingRequest?.payload}
          hasPendingRequest={Boolean(pendingRequest)}
          historyRequests={historyRequests}
          canEdit={canSubmitOwnDraft(profile)}
          error={params.draftError}
          success={params.draftSuccess}
          historyError={params.historyError}
          historySuccess={params.historySuccess}
        />
      ) : (
        <Card className="h-full">
          <CardHeader>
            <CardTitle>绑定成员</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">当前账号尚未绑定族谱成员，请联系管理员处理。</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    phoneError?: string;
    phoneSuccess?: string;
    draftError?: string;
    draftSuccess?: string;
    historyError?: string;
    historySuccess?: string;
  }>;
}) {
  return (
    <Suspense fallback={<div className="container mx-auto h-64 px-4 py-8" />}>
      <MyProfileContent searchParams={searchParams} />
    </Suspense>
  );
}
