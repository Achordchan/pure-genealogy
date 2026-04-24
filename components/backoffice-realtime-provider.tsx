"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isGoApiClientEnabled } from "@/lib/api/client";
import {
  canManageAccounts,
  canReviewMemberChanges,
  EMPTY_BACKOFFICE_NOTICE_COUNTS,
  type AccountProfile,
  type BackofficeNoticeCounts,
} from "@/lib/account/shared";

const BackofficeNoticeContext = createContext<BackofficeNoticeCounts>(EMPTY_BACKOFFICE_NOTICE_COUNTS);

function clampCount(value: number) {
  return Math.max(0, value);
}

export function BackofficeRealtimeProvider({
  profile,
  initialCounts,
  children,
}: {
  profile: Pick<AccountProfile, "id" | "role" | "status"> | null;
  initialCounts: BackofficeNoticeCounts;
  children: ReactNode;
}) {
  const [counts, setCounts] = useState(initialCounts);

  useEffect(() => {
    setCounts(initialCounts);
  }, [initialCounts]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (!isGoApiClientEnabled()) {
      return;
    }

    const shouldWatchAccounts = canManageAccounts(profile);
    const shouldWatchDrafts = canReviewMemberChanges(profile);

    if (!shouldWatchAccounts && !shouldWatchDrafts) {
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const source = new EventSource(new URL("/api/events", baseUrl).toString(), {
      withCredentials: true,
    });

    source.addEventListener("notice", (event) => {
      try {
        setCounts(JSON.parse(event.data) as BackofficeNoticeCounts);
      } catch {
        setCounts(initialCounts);
      }
    });

    return () => source.close();
  }, [profile]);

  const value = useMemo(() => counts, [counts]);

  return (
    <BackofficeNoticeContext.Provider value={value}>
      {children}
    </BackofficeNoticeContext.Provider>
  );
}

export function useBackofficeNoticeCounts() {
  return useContext(BackofficeNoticeContext);
}
