"use client";

import { cn } from "@/lib/utils";
import { signUpWithIdentityAction } from "@/app/auth/actions";
import type { AuthFormState } from "@/app/auth/actions";
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
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const initialState: AuthFormState = { error: null };
  const [state, formAction, isPending] = useActionState(
    signUpWithIdentityAction,
    initialState,
  );
  const [realName, setRealName] = useState("");
  const [idCard, setIdCard] = useState("");

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">注册</CardTitle>
          <CardDescription>请输入姓名和身份证号完成注册</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
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
              <p className="text-sm text-muted-foreground">
                注册后会进入待审核状态，管理员通过后才可进入族谱系统。
              </p>
              {state.error && <p className="text-sm text-red-500">{state.error}</p>}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? "正在注册..." : "注册"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              已经有账户了？{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
