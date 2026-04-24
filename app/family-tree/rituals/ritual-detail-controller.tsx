"use client";

import { useEffect, useState } from "react";
import { getMemberRitualByMemberId } from "../ritual-actions";
import type { RitualDetail } from "@/lib/rituals/shared";
import { RitualDetailDrawer } from "./ritual-detail-drawer";

const RITUAL_DETAIL_OPEN_EVENT = "ritual-detail-open";

export function openRitualDetail(memberId: number) {
  window.dispatchEvent(new CustomEvent(RITUAL_DETAIL_OPEN_EVENT, { detail: { memberId } }));
}

export function RitualDetailController({
  initialDetail,
  initialOpen,
}: {
  initialDetail: RitualDetail | null;
  initialOpen: boolean;
}) {
  const [detail, setDetail] = useState<RitualDetail | null>(initialDetail);
  const [open, setOpen] = useState(initialOpen);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleOpen = async (event: Event) => {
      const memberId = (event as CustomEvent<{ memberId: number }>).detail.memberId;
      setOpen(true);
      setIsLoading(true);

      try {
        setDetail(await getMemberRitualByMemberId(memberId));
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener(RITUAL_DETAIL_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(RITUAL_DETAIL_OPEN_EVENT, handleOpen);
  }, []);

  return (
    <RitualDetailDrawer
      detail={detail}
      open={open}
      isLoading={isLoading}
      onOpenChange={setOpen}
    />
  );
}
