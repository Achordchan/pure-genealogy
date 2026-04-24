"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isGoApiClientEnabled } from "@/lib/api/client";

export function PendingStatusListener({
  profileId,
  homePath,
}: {
  profileId: string;
  homePath: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isGoApiClientEnabled()) {
      return;
    }

    const refreshByStatus = (nextStatus?: unknown) => {
      if (nextStatus === "approved") {
        router.push(homePath);
        router.refresh();
        return;
      }

      router.refresh();
    };

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const source = new EventSource(new URL("/api/events", baseUrl).toString(), {
      withCredentials: true,
    });

    source.addEventListener("account-status", (event) => {
      try {
        const data = JSON.parse(event.data) as { profileId?: string; status?: string };
        if (!data.profileId || data.profileId === profileId) {
          refreshByStatus(data.status);
        }
      } catch {
        router.refresh();
      }
    });

    source.addEventListener("notice", () => router.refresh());

    return () => source.close();
  }, [homePath, profileId, router]);

  return null;
}
