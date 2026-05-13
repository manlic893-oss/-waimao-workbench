export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function hasSupabaseEnv() {
  return Boolean(getSupabaseEnv());
}

export function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY ?? null;
}

export function getOpenAIApiKey() {
  return process.env.OPENAI_API_KEY ?? null;
}

export function getDeepSeekApiKey() {
  return process.env.DEEPSEEK_API_KEY ?? null;
}

export function getAIProvider() {
  return process.env.AI_PROVIDER === "deepseek" ? "deepseek" : "openai";
}
