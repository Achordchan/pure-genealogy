"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { openRitualDetail } from "./ritual-detail-controller";

export function RitualDetailLink({
  href,
  memberId,
  children,
}: {
  href: string;
  memberId: number;
  children: ReactNode;
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    event.preventDefault();
    window.history.pushState(null, "", href);
    openRitualDetail(memberId);
  };

  return (
    <Link href={href} scroll={false} onClick={handleClick}>
      {children}
    </Link>
  );
}
