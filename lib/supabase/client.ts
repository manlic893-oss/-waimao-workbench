"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

let client: SupabaseClient | null = null;
let rememberMePreference = true;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getTimestampKey(key: string) {
  return `waimao-workbench:${key}:remembered_at`;
}

function getBrowserStorage() {
  return {
    getItem(key: string) {
      if (typeof window === "undefined") return null;

      const localValue = window.localStorage.getItem(key);
      if (localValue) {
        const rememberedAt = Number(window.localStorage.getItem(getTimestampKey(key)) ?? 0);
        if (rememberedAt && Date.now() - rememberedAt > THIRTY_DAYS_MS) {
          window.localStorage.removeItem(key);
          window.localStorage.removeItem(getTimestampKey(key));
        } else {
          return localValue;
        }
      }

      return window.sessionStorage.getItem(key);
    },
    setItem(key: string, value: string) {
      if (typeof window === "undefined") return;

      if (rememberMePreference) {
        window.localStorage.setItem(key, value);
        window.localStorage.setItem(getTimestampKey(key), String(Date.now()));
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
        window.localStorage.removeItem(getTimestampKey(key));
      }
    },
    removeItem(key: string) {
      if (typeof window === "undefined") return;

      window.localStorage.removeItem(key);
      window.localStorage.removeItem(getTimestampKey(key));
      window.sessionStorage.removeItem(key);
    },
  };
}

export function setRememberMePreference(value: boolean) {
  rememberMePreference = value;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("waimao-workbench:remember-me", String(value));
  }
}

export function getRememberMePreference() {
  if (typeof window === "undefined") return true;
  const saved = window.localStorage.getItem("waimao-workbench:remember-me");
  if (saved === null) return true;
  return saved === "true";
}

export function createBrowserSupabaseClient() {
  rememberMePreference = getRememberMePreference();

  if (client) {
    return client;
  }

  const env = getSupabaseEnv();
  if (!env) {
    throw new Error("缺少 Supabase 环境变量，请先配置 .env.local。");
  }

  client = createBrowserClient(env.url, env.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: getBrowserStorage(),
    },
  });
  return client;
}
