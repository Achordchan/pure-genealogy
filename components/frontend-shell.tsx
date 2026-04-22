import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MobileNav } from "@/components/mobile-nav";
import { AuthButton } from "@/components/auth-button";
import { BackofficeRealtimeProvider } from "@/components/backoffice-realtime-provider";
import { FAMILY_SURNAME } from "@/lib/utils";
import { getBackofficeNoticeCounts, getCurrentAccountProfile } from "@/lib/account/server";

function getNavigationItems(profile: Awaited<ReturnType<typeof getCurrentAccountProfile>>) {
  return [
    { href: "/family-tree/graph", label: "2D 族谱" },
    { href: "/family-tree/graph-3d", label: "3D 族谱" },
    { href: "/family-tree/timeline", label: "时间轴" },
    { href: "/family-tree/statistics", label: "统计分析" },
    { href: "/family-tree/biography-book", label: "生平册" },
    { href: "/me/profile", label: "我的资料" },
  ];
}

async function FrontendShellContent({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const profile = await getCurrentAccountProfile();
  const navigationItems = getNavigationItems(profile);
  const initialNoticeCounts = await getBackofficeNoticeCounts(profile);

  return (
    <BackofficeRealtimeProvider profile={profile} initialCounts={initialNoticeCounts}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link
              href="/family-tree/graph"
              className="text-lg font-semibold transition-opacity hover:opacity-80"
            >
              {FAMILY_SURNAME}氏族谱
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-primary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <ThemeSwitcher />
              <MobileNav items={navigationItems} />
              <Suspense fallback={<div className="h-9 w-9 rounded-md bg-muted md:w-40" />}>
                <AuthButton profile={profile} />
              </Suspense>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </BackofficeRealtimeProvider>
  );
}

export function FrontendShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <FrontendShellContent>{children}</FrontendShellContent>
    </Suspense>
  );
}
