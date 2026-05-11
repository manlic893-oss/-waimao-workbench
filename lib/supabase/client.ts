"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

export function createBrowserSupabaseClient() {
  if (client) {
    return client;
  }

  const env = getSupabaseEnv();
  if (!env) {
    throw new Error("缺少 Supabase 环境变量，请先配置 .env.local。");
  }

  client = createBrowserClient(env.url, env.anonKey);
  return client;
}
