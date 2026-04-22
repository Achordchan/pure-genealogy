"use client";

import Link from "next/link";
import { User2 } from "lucide-react";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";
import {
  type AccountProfile,
  canManageAccounts,
  canManageFamilyMembers,
  canReviewMemberChanges,
} from "@/lib/account/shared";
import { useBackofficeNoticeCounts } from "./backoffice-realtime-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getBackofficeEntryHref(
  profile: Pick<AccountProfile, "role" | "status">,
) {
  if (canManageFamilyMembers(profile) || canReviewMemberChanges(profile)) {
    return "/family-tree";
  }

  if (canManageAccounts(profile)) {
    return "/admin/accounts";
  }

  return null;
}

function formatBadgeCount(count: number) {
  if (count > 99) {
    return "99+";
  }

  return String(count);
}

export function AuthButton({
  profile,
}: {
  profile: Pick<AccountProfile, "real_name" | "role" | "status"> | null;
}) {
  if (!profile) {
    return (
      <>
        <div className="hidden md:flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/auth/login">登录</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/auth/sign-up">注册</Link>
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <User2 className="h-5 w-5" />
              <span className="sr-only">打开账户菜单</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/auth/login">登录</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/auth/sign-up">注册</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  const backendHref = getBackofficeEntryHref(profile);
  const noticeCounts = useBackofficeNoticeCounts();

  return (
    <>
      <div className="hidden md:flex items-center gap-3">
        <span className="max-w-[180px] truncate text-sm font-medium">
          你好，{profile.real_name}
        </span>
        {backendHref && (
          <div className="relative">
            <Button asChild size="sm" variant="secondary">
              <Link href={backendHref}>后台管理</Link>
            </Button>
            {noticeCounts.total > 0 && (
              <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-semibold leading-5 text-white">
                {formatBadgeCount(noticeCounts.total)}
              </span>
            )}
          </div>
        )}
        <LogoutButton />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <User2 className="h-5 w-5" />
            <span className="sr-only">打开账户菜单</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2 text-sm font-medium">你好，{profile.real_name}</div>
          <DropdownMenuSeparator />
          {backendHref && (
            <DropdownMenuItem asChild>
              <Link href={backendHref} className="flex w-full items-center justify-between">
                <span>后台管理</span>
                {noticeCounts.total > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-5 text-white">
                    {formatBadgeCount(noticeCounts.total)}
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
          )}
          <div className="p-2">
            <LogoutButton className="w-full" />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
