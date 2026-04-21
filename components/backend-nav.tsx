"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface BackendNavItem {
  href: string;
  label: string;
  badgeCount?: number;
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

  return (
    <nav className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => {
        const isActive = pathname === item.href;

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
            {item.badgeCount ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-semibold leading-5 text-white">
                {formatBadgeCount(item.badgeCount)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
