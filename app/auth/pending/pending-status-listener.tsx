"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PendingStatusListener({
  profileId,
  homePath,
}: {
  profileId: string;
  homePath: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`pending-status:${profileId}`);

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "account_profiles",
        filter: `id=eq.${profileId}`,
      },
      (payload) => {
        const nextStatus = payload.new?.status;

        if (nextStatus === "approved") {
          router.push(homePath);
          router.refresh();
          return;
        }

        router.refresh();
      },
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [homePath, profileId, router]);

  return null;
}
