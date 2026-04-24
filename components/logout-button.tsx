"use client";

import { useState } from "react";
import { clientApiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const logout = async () => {
    setIsPending(true);

    try {
      await clientApiFetch("/api/auth/logout", { method: "POST" });
      router.replace("/auth/login");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button type="button" onClick={logout} className={cn(className)} disabled={isPending}>
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {isPending ? "退出中..." : "登出"}
    </Button>
  );
}
