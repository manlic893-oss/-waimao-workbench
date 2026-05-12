"use client";

import type { InputHTMLAttributes } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { addDays, getISODay } from "date-fns";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { EnvNotice } from "@/components/shared/env-notice";
import { FollowupNotifier } from "@/components/shared/followup-notifier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FIXED_TASK_TEMPLATES, TASK_CATEGORIES } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/env";
import { formatDate, toDateInputValue } from "@/lib/utils";
import { statsSchema, taskSchema, type StatsFormValues, type TaskFormValues } from "@/lib/validators/task";
import type { Customer, DailyStat, DailyTaskRecord, FixedTask } from "@/types/database";

export function TasksClient() {
  const [date, setDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<DailyTaskRecord[]>([]);
  const [fixedTasks, setFixedTasks] = useState<FixedTask[]>([]);
  const [stat, setStat] = useState<DailyStat | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [savingStats, setSavingStats] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskNotice, setTaskNotice] = useState<string>("");
  const [statsNotice, setStatsNotice] = useState<string>("");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [dailySummary, setDailySummary] = useState<{ summary: string; encouragement: string } | null>(null);

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      category: "other",
    },
  });

  const statsForm = useForm<StatsFormValues>({
    resolver: zodResolver(statsSchema),
    defaultValues: {
      inquiry_count: 0,
      rfq_sent: 0,
      new_products: 0,
      orders_closed: 0,
      notes: "",
    },
  });

  const dateKey = toDateInputValue(date);

  const seedFixedTasksIfNeeded = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.from("fixed_tasks").select("*");
    if ((data ?? []).length > 0) {
      return (data ?? []) as FixedTask[];
    }

    await supabase.from("fixed_tasks").insert(
      FIXED_TASK_TEMPLATES.map((item) => ({
        category: item.category,
        weekday: item.category === "weekly" ? item.weekday : null,
        title: item.title,
        task_category: item.taskCategory,
        sort_order: item.sortOrder,
        is_active: true,
      })),
    );

    const { data: seeded } = await supabase.from("fixed_tasks").select("*").order("sort_order", { ascending: true });
    return (seeded ?? []) as FixedTask[];
  }, []);

  const hydrateForDate = useCallback(async () => {
    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;

    const allFixedTasks = await seedFixedTasksIfNeeded();
    setFixedTasks(allFixedTasks);

    const weekday = getISODay(date);
    const activeTemplates = allFixedTasks.filter(
      (task) => task.is_active && (task.category === "daily" || (task.category === "weekly" && task.weekday === weekday)),
    );

    const existingRecordsResult = await supabase
      .from("daily_task_records")
      .select("*")
      .eq("date", dateKey)
      .or(`user_id.eq.${user.id},created_by.eq.${user.id}`);
    const existingRecords = (existingRecordsResult.data ?? []) as DailyTaskRecord[];
    const existingFixedTaskIds = new Set(existingRecords.map((record) => record.fixed_task_id).filter(Boolean));

    const missingRecords = activeTemplates.filter((task) => !existingFixedTaskIds.has(task.id));
    if (missingRecords.length > 0) {
      await supabase.from("daily_task_records").insert(
        missingRecords.map((task) => ({
          date: dateKey,
          user_id: user.id,
          fixed_task_id: task.id,
          title: task.title,
          category: task.task_category,
          done: false,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })),
      );
    }

    const [recordsResult, statsResult, customersResult] = await Promise.all([
      supabase
        .from("daily_task_records")
        .select("*")
        .eq("date", dateKey)
        .or(`user_id.eq.${user.id},created_by.eq.${user.id}`)
        .order("created_at", { ascending: true }),
      supabase.from("daily_stats").select("*").eq("date", dateKey).or(`user_id.eq.${user.id},created_by.eq.${user.id}`).maybeSingle(),
      supabase
        .from("customers")
        .select("id,next_follow_date")
        .lte("next_follow_date", dateKey)
        .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`),
    ]);

    if (!recordsResult.error) setTasks((recordsResult.data ?? []) as DailyTaskRecord[]);
    if (!customersResult.error) setDueCount(((customersResult.data ?? []) as Array<Pick<Customer, "id" | "next_follow_date">>).length);

    if (!statsResult.error) {
      setStat((statsResult.data as DailyStat | null) ?? null);
      statsForm.reset({
        inquiry_count: statsResult.data?.inquiry_count ?? 0,
        rfq_sent: statsResult.data?.rfq_sent ?? 0,
        new_products: statsResult.data?.new_products ?? 0,
        orders_closed: statsResult.data?.orders_closed ?? 0,
        notes: statsResult.data?.notes ?? "",
      });
    }
  }, [date, dateKey, seedFixedTasksIfNeeded, statsForm]);

  useEffect(() => {
    hydrateForDate();

    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`tasks-${dateKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_task_records" }, hydrateForDate)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_stats" }, hydrateForDate)
      .on("postgres_changes", { event: "*", schema: "public", table: "fixed_tasks" }, hydrateForDate)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, hydrateForDate)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dateKey, hydrateForDate]);

  const completedCount = tasks.filter((task) => task.done).length;
  const progressValue = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const fixedTaskMap = useMemo(() => new Map(fixedTasks.map((task) => [task.id, task])), [fixedTasks]);

  const taskSections = useMemo(() => {
    const dailyFixedTasks: DailyTaskRecord[] = [];
    const weeklyFixedTasks: DailyTaskRecord[] = [];
    const customTasks: DailyTaskRecord[] = [];

    for (const task of tasks) {
      if (!task.fixed_task_id) {
        customTasks.push(task);
        continue;
      }

      const fixedTask = fixedTaskMap.get(task.fixed_task_id);
      if (fixedTask?.category === "weekly") {
        weeklyFixedTasks.push(task);
      } else {
        dailyFixedTasks.push(task);
      }
    }

    return [
      {
        key: "daily-fixed",
        title: "每日固定任务",
        description: "每天都会自动生成，适合日常必须完成的动作。",
        items: dailyFixedTasks,
      },
      {
        key: "weekly-fixed",
        title: "每周固定任务",
        description: "只会在指定星期出现，用来安排阶段性重点工作。",
        items: weeklyFixedTasks,
      },
      {
        key: "custom",
        title: "自定义任务",
        description: "临时新增、只属于当天的个人安排。",
        items: customTasks,
      },
    ].filter((section) => section.items.length > 0);
  }, [fixedTaskMap, tasks]);

  const handleCreateTask = taskForm.handleSubmit(async (values) => {
    setCreatingTask(true);
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setCreatingTask(false);
      return;
    }

    const { error } = await supabase.from("daily_task_records").insert({
      date: dateKey,
      user_id: user.id,
      title: values.title,
      category: values.category,
      fixed_task_id: null,
      done: false,
      created_by: user?.id ?? null,
      updated_by: user.id,
    });

    if (!error) {
      taskForm.reset({ title: "", category: "other" });
      setTaskNotice("今日任务已添加，可以继续补充或删除。");
    }
    setCreatingTask(false);
  });

  const handleToggleTask = async (task: DailyTaskRecord) => {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;
    await supabase
      .from("daily_task_records")
      .update({ done: !task.done, updated_by: user?.id ?? null })
      .eq("id", task.id)
      .or(`user_id.eq.${user.id},created_by.eq.${user.id}`);
    setTaskNotice(!task.done ? "任务已标记为完成。" : "任务已重新改为未完成。");
  };

  const handleDeleteTask = async (taskId: string) => {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;
    await supabase.from("daily_task_records").delete().eq("id", taskId).or(`user_id.eq.${user.id},created_by.eq.${user.id}`);
    setTaskNotice("自定义任务已删除。");
  };

  const startEditFixedTask = (task: DailyTaskRecord) => {
    if (!task.fixed_task_id) return;
    setEditingRecordId(task.id);
    setEditingTitle(task.title);
  };

  const handleSaveEditedTitle = async (task: DailyTaskRecord) => {
    if (!task.fixed_task_id) return;
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;
    await Promise.all([
      supabase.from("fixed_tasks").update({ title: editingTitle }).eq("id", task.fixed_task_id),
      supabase.from("daily_task_records").update({ title: editingTitle }).eq("id", task.id).or(`user_id.eq.${user.id},created_by.eq.${user.id}`),
    ]);
    setEditingRecordId(null);
    setEditingTitle("");
    setTaskNotice("固定任务标题已更新。");
  };

  const handleSaveStats = statsForm.handleSubmit(async (values) => {
    setSavingStats(true);
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setSavingStats(false);
      return;
    }

    const savePayload = {
        id: stat?.id,
        date: dateKey,
        user_id: user.id,
      inquiry_count: values.inquiry_count,
      rfq_sent: values.rfq_sent,
      new_products: values.new_products,
      orders_closed: values.orders_closed,
      notes: values.notes || null,
      ai_summary: stat?.ai_summary ?? null,
      submitted_at: new Date().toISOString(),
      created_by: stat?.created_by ?? user.id,
      updated_by: user.id,
    };

    await supabase.from("daily_stats").upsert(
      {
        ...savePayload,
      },
      { onConflict: "date,user_id" },
    );

    const summaryResponse = await fetch("/api/daily-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const summaryData = (await summaryResponse.json()) as { summary: string; encouragement: string };

    await supabase
      .from("daily_stats")
      .update({
        ai_summary: `${summaryData.summary}\n${summaryData.encouragement}`,
        submitted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("date", dateKey)
      .or(`user_id.eq.${user.id},created_by.eq.${user.id}`);

    setDailySummary(summaryData);
    setSummaryOpen(true);
    setStatsNotice("今日日报已提交，可以继续回来修改。");
    await hydrateForDate();
    setSavingStats(false);
  });

  if (!hasSupabaseEnv()) {
    return <EnvNotice />;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <Badge>每日工作清单</Badge>
        <h1 className="text-3xl font-semibold">今日执行面板</h1>
        <p className="text-sm text-muted-foreground">固定任务按日期自动生成，日报按账号单独提交，历史日期可回看已保存内容。</p>
      </section>

      <FollowupNotifier dueCount={dueCount} />

      <section className="grid gap-4 rounded-[1.75rem] border bg-white/90 p-5 lg:grid-cols-[1fr_1.2fr_auto] lg:items-center">
        <div className="space-y-1">
          <p className="text-2xl font-semibold">
            {formatDate(date, "yyyy年MM月dd日")} {formatDate(date, "EEEE")}
          </p>
          {dueCount > 0 ? (
            <p className="text-sm text-rose-700">
              今日有 {dueCount} 位客户需要跟进，
              <Link className="font-medium underline underline-offset-4" href="/customers?filter=due-today">
                点击查看
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">今天暂时没有新的跟进提醒。</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>已完成 {completedCount} / {tasks.length} 项</span>
            <span className="text-muted-foreground">{progressValue}%</span>
          </div>
          <Progress value={progressValue} />
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="icon" onClick={() => setDate((current) => addDays(current, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-center text-xs text-muted-foreground">切换日期</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setDate((current) => addDays(current, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>任务列表</CardTitle>
              <p className="text-sm text-muted-foreground">固定任务和本周任务分组展示，双击标题可直接改内容。</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {taskNotice ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{taskNotice}</div> : null}
              {taskSections.map((section) => (
                <div key={section.key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{section.title}</p>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{section.items.length} 项</span>
                  </div>
                  <div className="space-y-3">
                    {section.items.map((task) => {
                      const categoryLabel = TASK_CATEGORIES.find((item) => item.value === task.category)?.label ?? "其他";

                      return (
                      <div key={task.id} className="flex items-center justify-between rounded-2xl border bg-white/60 p-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <Checkbox checked={task.done} onChange={() => handleToggleTask(task)} />
                          <div className="min-w-0">
                            {editingRecordId === task.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editingTitle}
                                  onChange={(event) => setEditingTitle(event.target.value)}
                                  onBlur={() => void handleSaveEditedTitle(task)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleSaveEditedTitle(task);
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <p
                                className={task.done ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"}
                                onDoubleClick={() => startEditFixedTask(task)}
                              >
                                {task.title}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{task.fixed_task_id ? "固定任务" : "自定义任务"}</span>
                              <span>·</span>
                              <span>{categoryLabel}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {task.fixed_task_id ? (
                            <Button variant="ghost" size="icon" onClick={() => startEditFixedTask(task)}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          ) : null}
                          {!task.fixed_task_id ? (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>+ 添加今日临时任务</CardTitle>
              <p className="text-sm text-muted-foreground">只影响你自己的当天任务列表，后面可以删除。</p>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-[1fr_180px_auto]" onSubmit={handleCreateTask}>
                <div>
                  <Label className="mb-2 block">任务标题</Label>
                  <Input placeholder="例如：整理新客户样品报价表" {...taskForm.register("title")} />
                  <p className="mt-1 text-xs text-destructive">{taskForm.formState.errors.title?.message}</p>
                </div>
                <div>
                  <Label className="mb-2 block">分类</Label>
                  <Select options={TASK_CATEGORIES.map((item) => ({ value: item.value, label: item.label }))} {...taskForm.register("category")} />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" disabled={creatingTask}>
                    {creatingTask ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    添加任务
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>每日数据填报</CardTitle>
            <p className="text-sm text-muted-foreground">以下日报按当前账号单独保存，提交后会自动生成 AI 总结和小激励。</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {statsNotice ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{statsNotice}</div> : null}
            <form className="space-y-4" onSubmit={handleSaveStats}>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumericField label="今日询盘数" inputProps={statsForm.register("inquiry_count", { valueAsNumber: true })} />
                <NumericField label="RFQ报价发送数" inputProps={statsForm.register("rfq_sent", { valueAsNumber: true })} />
                <NumericField label="新发品数" inputProps={statsForm.register("new_products", { valueAsNumber: true })} />
                <NumericField label="成交订单数" inputProps={statsForm.register("orders_closed", { valueAsNumber: true })} />
              </div>
              <div>
                <Label className="mb-2 block">每日总结</Label>
                <Textarea
                  placeholder="记录今天的重点动作、收获、问题和明天准备跟进什么。"
                  rows={6}
                  {...statsForm.register("notes")}
                />
              </div>
              {stat?.ai_summary ? (
                <div className="rounded-2xl bg-indigo-50 px-4 py-3">
                  <p className="text-sm font-medium text-indigo-800">已保存的 AI 总结</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-indigo-700">{stat.ai_summary}</p>
                </div>
              ) : null}
              <Button type="submit" disabled={savingStats}>
                {savingStats ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                提交今日日报
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>今日日报已生成</DialogTitle>
            <DialogDescription>下面是根据今天的数字和备注自动生成的总结与鼓励。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white/70 p-4 text-sm leading-6">
              <p>今日询盘数：{statsForm.getValues("inquiry_count")}</p>
              <p>RFQ 报价发送数：{statsForm.getValues("rfq_sent")}</p>
              <p>新发品数：{statsForm.getValues("new_products")}</p>
              <p>成交订单数：{statsForm.getValues("orders_closed")}</p>
            </div>
            <div className="rounded-2xl bg-secondary/60 p-4">
              <p className="text-sm font-medium">AI 总结</p>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{dailySummary?.summary}</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 p-4">
              <p className="text-sm font-medium text-indigo-800">今日小激励</p>
              <p className="mt-2 whitespace-pre-line text-sm text-indigo-700">{dailySummary?.encouragement}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSummaryOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NumericField({
  label,
  inputProps,
}: {
  label: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <Input type="number" min={0} {...inputProps} />
    </div>
  );
}
