import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EnvNotice() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>还没连接 Supabase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>请先在 `.env.local` 中配置 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。</p>
        <p>配置完成后重新启动开发服务器，再登录和联调各模块。</p>
      </CardContent>
    </Card>
  );
}
