"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { authSchema, type AuthValues } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: AuthValues) => {
    try {
      setSubmitting(true);
      setMessage("");
      const supabase = createBrowserSupabaseClient();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword(values);
        if (error) throw error;
        window.location.href = "/dashboard";
        return;
      }

      const { error } = await supabase.auth.signUp(values);
      if (error) throw error;
      setMessage("注册成功，请返回邮箱确认后登录。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-white/60 bg-white/90">
      <CardHeader>
        <CardTitle>{mode === "login" ? "登录工作台" : "注册协作账号"}</CardTitle>
        <CardDescription>登录后即可与团队成员共享客户、任务和日报数据。</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" type="email" placeholder="team@example.com" {...form.register("email")} />
            <p className="text-xs text-destructive">{form.formState.errors.email?.message}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" type="password" placeholder="至少 6 位" {...form.register("password")} />
            <p className="text-xs text-destructive">{form.formState.errors.password?.message}</p>
          </div>

          {message ? <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}

          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "login" ? "登录" : "注册"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "login" ? "还没有账号？" : "已经有账号？"}
          <button
            type="button"
            className="ml-1 font-medium text-primary"
            onClick={() => setMode((current) => (current === "login" ? "signup" : "login"))}
          >
            {mode === "login" ? "去注册" : "去登录"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
