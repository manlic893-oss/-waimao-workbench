import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { EnvNotice } from "@/components/shared/env-notice";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  if (hasSupabaseEnv()) {
    const supabase = createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="grid w-full max-w-5xl gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/60 bg-hero-grid p-8 shadow-panel md:p-10">
          <div className="max-w-xl space-y-6">
            <div className="inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-primary shadow-sm">
              外贸小团队专用
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
                把客户跟进、每日执行和结果数据放进同一个工作台
              </h1>
              <p className="text-base leading-7 text-slate-600">
                统一管理客户状态、自动补齐每日固定任务、实时查看团队数据趋势，让两个人也能像成熟团队一样稳定协作。
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          {hasSupabaseEnv() ? <AuthForm /> : <EnvNotice />}
        </section>
      </div>
    </main>
  );
}
