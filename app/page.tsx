import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function HomePage() {
  if (!hasSupabaseEnv()) {
    redirect("/login");
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  redirect(session ? "/dashboard" : "/login");
}
