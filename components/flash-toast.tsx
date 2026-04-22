"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import type { FlashMessage } from "@/lib/flash";

interface FlashToastProps {
  flash: FlashMessage | null;
}

export function FlashToast({ flash }: FlashToastProps) {
  useEffect(() => {
    if (!flash) {
      return;
    }

    if (flash.type === "error") {
      toast.error(flash.message);
      return;
    }

    toast.success(flash.message);
  }, [flash]);

  return null;
}
