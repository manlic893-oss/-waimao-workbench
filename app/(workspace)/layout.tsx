import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!hasSupabaseEnv()) {
    return <AppShell userEmail="未配置环境变量">{children}</AppShell>;
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return <AppShell userEmail={session.user.email ?? "已登录用户"}>{children}</AppShell>;
}
