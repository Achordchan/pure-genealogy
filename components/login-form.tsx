"use client";

import { cn } from "@/lib/utils";
import type { AuthFormState } from "@/app/auth/actions";
import { clientApiFetch } from "@/lib/api/client";
import { getAccountHomePath, validateIdCard, validateRealName, type AccountProfile } from "@/lib/account/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const [state, setState] = useState<AuthFormState>({ error: null });
  const [isPending, setIsPending] = useState(false);
  const [realName, setRealName] = useState("");
  const [idCard, setIdCard] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateRealName(realName) ?? validateIdCard(idCard);

    if (validationError) {
      setState({ error: validationError });
      return;
    }

    setIsPending(true);
    setState({ error: null });

    try {
      const response = await clientApiFetch<{ profile: AccountProfile }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ realName, idCard }),
      });
      router.replace(getAccountHomePath(response.profile));
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "登录失败，请稍后重试" });
      setIsPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">登录</CardTitle>
          <CardDescription>请输入姓名和身份证号登录系统</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="realName">姓名</Label>
                <Input
                  id="realName"
                  name="realName"
                  type="text"
                  value={realName}
                  onChange={(event) => setRealName(event.target.value)}
                  placeholder="请输入真实姓名"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="idCard">身份证号</Label>
                <Input
                  id="idCard"
                  name="idCard"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={idCard}
                  onChange={(event) => setIdCard(event.target.value)}
                  placeholder="请输入18位身份证号"
                  required
                />
              </div>
              {state.error && <p className="text-sm text-red-500">{state.error}</p>}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? "登录中..." : "登录"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              还没有账户？{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                注册
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
