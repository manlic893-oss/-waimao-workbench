"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { subDays } from "date-fns";
import { BarChart3, CheckCheck, PackagePlus, Send, TrendingUp, Users } from "lucide-react";
import { Line, LineChart, CartesianGrid, Pie, PieChart, Cell, Tooltip, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { EnvNotice } from "@/components/shared/env-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";
import { formatDate, toDateInputValue, isDueTodayOrOverdue } from "@/lib/utils";
import { CUSTOMER_STATUSES } from "@/lib/constants";
import type { Customer, DailyStat, DailyTaskRecord } from "@/types/database";

const pieColors = ["#3B5BDB", "#748FFC", "#A5B4FC", "#CBD5E1", "#8B5CF6", "#22C55E", "#F59E0B"];

type TeamCustomerDashboard = {
  totalCount: number;
  dueCount: number;
  gradeACount: number;
  closedCount: number;
  sourceData: Array<{ name: string; value: number }>;
  funnelData: Array<{ status: string; value: number }>;
};

export function DashboardClient() {
  const [ownCustomers, setOwnCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [tasks, setTasks] = useState<DailyTaskRecord[]>([]);
  const [teamDashboard, setTeamDashboard] = useState<TeamCustomerDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!hasSupabaseEnv()) {
      setLoading(false);
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 29);

    const [customersResult, statsResult, tasksResult, dashboardResult] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase
        .from("daily_stats")
        .select("*")
        .gte("date", toDateInputValue(thirtyDaysAgo))
        .order("date", { ascending: true }),
      supabase.from("daily_task_records").select("*").eq("date", toDateInputValue(today)),
      supabase.rpc("get_team_customer_dashboard"),
    ]);

    if (!customersResult.error) setOwnCustomers(customersResult.data ?? []);
    if (!statsResult.error) setStats(statsResult.data ?? []);
    if (!tasksResult.error) setTasks(tasksResult.data ?? []);
    if (!dashboardResult.error && dashboardResult.data) setTeamDashboard(dashboardResult.data as TeamCustomerDashboard);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();

    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, loadDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_task_records" }, loadDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_stats" }, loadDashboard)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const currentMonthStats = useMemo(() => {
    const now = new Date();
    return stats.filter((item) => {
      const date = new Date(item.date);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
  }, [stats]);

  const metricCards = [
    {
      title: "本月总询盘数",
      value: currentMonthStats.reduce((sum, item) => sum + item.inquiry_count, 0),
      icon: TrendingUp,
    },
    {
      title: "本月 RFQ 报价",
      value: currentMonthStats.reduce((sum, item) => sum + item.rfq_sent, 0),
      icon: Send,
    },
    {
      title: "本月新发品",
      value: currentMonthStats.reduce((sum, item) => sum + item.new_products, 0),
      icon: PackagePlus,
    },
    {
      title: "本月成交订单",
      value: currentMonthStats.reduce((sum, item) => sum + item.orders_closed, 0),
      icon: CheckCheck,
    },
  ];

  const inquiryTrend = useMemo(
    () =>
      stats.map((item) => ({
        date: formatDate(item.date, "MM/dd"),
        count: item.inquiry_count,
      })),
    [stats],
  );

  const funnelData = useMemo(
    () =>
      CUSTOMER_STATUSES.filter((status) => status.value !== "lost").map((status) => ({
        label: status.label,
        value: teamDashboard?.funnelData.find((item) => item.status === status.value)?.value ?? 0,
      })),
    [teamDashboard],
  );

  const sourceData = useMemo(() => teamDashboard?.sourceData ?? [], [teamDashboard]);

  const todayFollowups = useMemo(
    () =>
      ownCustomers
        .filter((customer) => isDueTodayOrOverdue(customer.next_follow_date))
        .sort((a, b) => (a.next_follow_date ?? "").localeCompare(b.next_follow_date ?? ""))
        .slice(0, 5),
    [ownCustomers],
  );

  const undoneTasks = tasks.filter((task) => !task.done).length;

  if (!hasSupabaseEnv()) {
    return <EnvNotice />;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <Badge>数据看板</Badge>
        <h1 className="text-3xl font-semibold">团队经营概览</h1>
        <p className="text-sm text-muted-foreground">围绕询盘、RFQ、产品和成交结果，快速掌握最近的工作节奏。</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => (
          <Card key={item.title}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">{item.title}</p>
                <p className="mt-3 text-3xl font-semibold">{loading ? "--" : item.value}</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <item.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>过去 30 天询盘趋势</CardTitle>
            <CardDescription>以日报中的询盘数为准，观察波峰与回落区间。</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inquiryTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" stroke="#64748B" />
                <YAxis stroke="#64748B" allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3B5BDB" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今日待办提醒</CardTitle>
            <CardDescription>把今天最需要处理的任务和客户先拎出来。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-3xl bg-secondary/70 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-3 text-primary">
                  <BarChart3 className="h-5 w-5" />
                </div>
               <div>
                  <p className="text-sm text-muted-foreground">今日未完成任务</p>
                  <p className="text-2xl font-semibold">{undoneTasks} 项</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">我今日需跟进的客户</p>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              {todayFollowups.length > 0 ? (
                <div className="space-y-3">
                  {todayFollowups.map((customer) => (
                    <div key={customer.id} className="rounded-2xl border bg-white/60 p-3">
                      <p className="font-medium">{customer.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{customer.product || "暂无产品需求描述"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">今天暂时没有待跟进客户。</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>客户漏斗</CardTitle>
            <CardDescription>按团队全部客户的跟进状态聚合，查看当前转化分布。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnelData.map((item, index) => (
              <div key={item.label} className="rounded-2xl border bg-white/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-sm text-muted-foreground">{item.value} 位</span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${teamDashboard?.totalCount ? (item.value / teamDashboard.totalCount) * 100 : 0}%`,
                      backgroundColor: pieColors[index],
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>客户来源分布</CardTitle>
            <CardDescription>按团队全部客户统计当前客户更多来自哪些渠道。</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" outerRadius={110} innerRadius={56} paddingAngle={3}>
                  {sourceData.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
