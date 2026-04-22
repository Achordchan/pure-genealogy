"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
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

function getPendingDelta(oldStatus?: string, newStatus?: string) {
  const wasPending = oldStatus === "pending";
  const isPending = newStatus === "pending";
  return Number(isPending) - Number(wasPending);
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

    const shouldWatchAccounts = canManageAccounts(profile);
    const shouldWatchDrafts = canReviewMemberChanges(profile);

    if (!shouldWatchAccounts && !shouldWatchDrafts) {
      return;
    }

    const supabase = createClient();
    const channel = supabase.channel(`backoffice-notices:${profile.id}`);

    if (shouldWatchAccounts) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "account_profiles",
          filter: "status=in.(pending,approved,rejected)",
        },
        (payload) => {
          const delta = getPendingDelta(
            payload.eventType === "INSERT" ? undefined : payload.old?.status,
            payload.eventType === "DELETE" ? undefined : payload.new?.status,
          );

          if (delta === 0) {
            return;
          }

          setCounts((current) => {
            const pending_accounts = clampCount(current.pending_accounts + delta);
            return {
              ...current,
              pending_accounts,
              total: pending_accounts + current.pending_member_changes,
            };
          });
        },
      );
    }

    if (shouldWatchDrafts) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "member_change_requests",
          filter: "status=in.(pending,approved,rejected)",
        },
        (payload) => {
          const delta = getPendingDelta(
            payload.eventType === "INSERT" ? undefined : payload.old?.status,
            payload.eventType === "DELETE" ? undefined : payload.new?.status,
          );

          if (delta === 0) {
            return;
          }

          setCounts((current) => {
            const pending_member_changes = clampCount(current.pending_member_changes + delta);
            return {
              ...current,
              pending_member_changes,
              total: current.pending_accounts + pending_member_changes,
            };
          });
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
