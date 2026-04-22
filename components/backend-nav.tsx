"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useBackofficeNoticeCounts } from "./backoffice-realtime-provider";

interface BackendNavItem {
  href: string;
  label: string;
}

function formatBadgeCount(count: number) {
  if (count > 99) {
    return "99+";
  }

  return String(count);
}

export function BackendNav({
  items,
  className,
}: {
  items: BackendNavItem[];
  className?: string;
}) {
  const pathname = usePathname();
  const counts = useBackofficeNoticeCounts();

  return (
    <nav className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => {
        const isActive = pathname === item.href;
        const badgeCount =
          item.href === "/admin/accounts"
            ? counts.pending_accounts
            : item.href === "/review/member-changes"
              ? counts.pending_member_changes
              : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative rounded-md px-3 py-2 pr-8 text-sm transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
            {badgeCount > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-semibold leading-5 text-white">
                {formatBadgeCount(badgeCount)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
