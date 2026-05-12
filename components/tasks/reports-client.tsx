"use client";

import { CalendarDays, ChevronLeft, FileText } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfMonth, min, startOfMonth, subDays } from "date-fns";
import { EnvNotice } from "@/components/shared/env-notice";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasSupabaseEnv } from "@/lib/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { formatDate, toDateInputValue } from "@/lib/utils";
import type { DailyReportHistoryItem } from "@/types/database";

type RangeKey = "7d" | "30d" | "month";

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "7d", label: "最近 7 天" },
  { key: "30d", label: "最近 30 天" },
  { key: "month", label: "本月" },
];

export function ReportsClient() {
  const [items, setItems] = useState<DailyReportHistoryItem[]>([]);
  const [range, setRange] = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    if (!hasSupabaseEnv()) {
      setLoading(false);
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }

    const today = new Date();
    const fetchStart = min([subDays(today, 29), startOfMonth(today)]);
    const startDate = toDateInputValue(fetchStart);
    const endDate = toDateInputValue(endOfMonth(today));

    const [primaryResult, legacyResult] = await Promise.all([
      supabase
        .from("daily_stats")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false }),
      supabase
        .from("daily_stats")
        .select("*")
        .is("user_id", null)
        .eq("created_by", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false }),
    ]);

    const merged = new Map<string, DailyReportHistoryItem>();
    for (const item of (primaryResult.data ?? []) as DailyReportHistoryItem[]) {
      merged.set(item.date, item);
    }
    for (const item of (legacyResult.data ?? []) as DailyReportHistoryItem[]) {
      if (!merged.has(item.date)) {
        merged.set(item.date, item);
      }
    }

    setItems(Array.from(merged.values()).sort((a, b) => b.date.localeCompare(a.date)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadReports();

    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("task-reports-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_stats" }, loadReports)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadReports]);

  const filteredItems = useMemo(() => {
    const today = new Date();
    const startDate =
      range === "7d"
        ? subDays(today, 6)
        : range === "30d"
          ? subDays(today, 29)
          : startOfMonth(today);
    const startKey = toDateInputValue(startDate);
    const endKey = toDateInputValue(range === "month" ? endOfMonth(today) : today);

    return items.filter((item) => item.date >= startKey && item.date <= endKey);
  }, [items, range]);

  if (!hasSupabaseEnv()) {
    return <EnvNotice />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge>每日日报历史</Badge>
          <h1 className="text-3xl font-semibold">我的日报记录</h1>
          <p className="text-sm text-muted-foreground">这里只展示当前账号提交过的日报，方便你按日期回看与修改。</p>
        </div>
        <Link href="/tasks" className={buttonVariants({ variant: "outline" })}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          返回每日清单
        </Link>
      </section>

      <section className="flex flex-wrap gap-3">
        {RANGE_OPTIONS.map((option) => (
          <Button
            key={option.key}
            variant={range === option.key ? "default" : "outline"}
            size="sm"
            onClick={() => setRange(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </section>

      <section className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">正在加载你的日报历史...</CardContent>
          </Card>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Card key={item.id} className="bg-white/90">
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <CardTitle className="text-xl">{formatDate(item.date, "yyyy年MM月dd日 EEEE")}</CardTitle>
                  </div>
                  <Link href={`/tasks?date=${item.date}`} className={buttonVariants({ size: "sm" })}>
                    去查看/修改当天日报
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricItem label="询盘数" value={item.inquiry_count} />
                  <MetricItem label="RFQ 报价数" value={item.rfq_sent} />
                  <MetricItem label="新发品数" value={item.new_products} />
                  <MetricItem label="成交订单数" value={item.orders_closed} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-secondary/30 p-4">
                  <p className="text-sm font-medium">每日总结/备注</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{item.notes?.trim() || "当天没有填写总结。"}</p>
                </div>
                {item.ai_summary?.trim() ? (
                  <div className="rounded-2xl bg-indigo-50 p-4">
                    <p className="text-sm font-medium text-indigo-800">AI 总结</p>
                    <p className="mt-2 whitespace-pre-line text-sm text-indigo-700">{item.ai_summary}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="rounded-2xl bg-secondary p-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">你还没有提交过日报</p>
                <p className="mt-1 text-sm text-muted-foreground">先去每日清单填写一份日报，之后这里就会按日期自动沉淀下来。</p>
              </div>
              <Link href="/tasks" className={buttonVariants({ size: "sm" })}>
                去填写今日日报
              </Link>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white/70 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
