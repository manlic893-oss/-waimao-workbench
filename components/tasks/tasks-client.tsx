"use client";

import type { InputHTMLAttributes } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { addDays } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { EnvNotice } from "@/components/shared/env-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FIXED_TASK_TEMPLATES, TASK_CATEGORIES } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/env";
import { formatDate, toDateInputValue } from "@/lib/utils";
import { statsSchema, taskSchema, type StatsFormValues, type TaskFormValues } from "@/lib/validators/task";
import type { DailyStat, DailyTask } from "@/types/database";

export function TasksClient() {
  const [date, setDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [stat, setStat] = useState<DailyStat | null>(null);
  const [savingStats, setSavingStats] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

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

  const hydrateForDate = useCallback(async () => {
    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const existingTasksResult = await supabase.from("daily_tasks").select("*").eq("date", dateKey);
    const existingTasks = existingTasksResult.data ?? [];
    const existingTemplateKeys = new Set(existingTasks.filter((task) => task.template_key).map((task) => task.template_key));

    const missingTemplates = FIXED_TASK_TEMPLATES.filter((item) => !existingTemplateKeys.has(item.templateKey));

    if (missingTemplates.length > 0) {
      await supabase.from("daily_tasks").insert(
        missingTemplates.map((item) => ({
          date: dateKey,
          title: item.title,
          category: item.category,
          is_template: true,
          template_key: item.templateKey,
          done: false,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })),
      );
    }

    const [tasksResult, statsResult] = await Promise.all([
      supabase.from("daily_tasks").select("*").eq("date", dateKey).order("created_at", { ascending: true }),
      supabase.from("daily_stats").select("*").eq("date", dateKey).maybeSingle(),
    ]);

    if (!tasksResult.error) setTasks(tasksResult.data ?? []);
    if (!statsResult.error) {
      setStat(statsResult.data ?? null);
      statsForm.reset({
        inquiry_count: statsResult.data?.inquiry_count ?? 0,
        rfq_sent: statsResult.data?.rfq_sent ?? 0,
        new_products: statsResult.data?.new_products ?? 0,
        orders_closed: statsResult.data?.orders_closed ?? 0,
        notes: statsResult.data?.notes ?? "",
      });
    }
  }, [dateKey, statsForm]);

  useEffect(() => {
    hydrateForDate();

    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`tasks-${dateKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_tasks" }, hydrateForDate)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_stats" }, hydrateForDate)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dateKey, hydrateForDate]);

  const completedCount = tasks.filter((task) => task.done).length;
  const progressValue = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const groupedTasks = useMemo(() => {
    return TASK_CATEGORIES.map((category) => ({
      ...category,
      items: tasks.filter((task) => task.category === category.value),
    })).filter((group) => group.items.length > 0);
  }, [tasks]);

  const handleCreateTask = taskForm.handleSubmit(async (values) => {
    setCreatingTask(true);
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("daily_tasks").insert({
      date: dateKey,
      title: values.title,
      category: values.category,
      is_template: false,
      done: false,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    });

    if (!error) {
      taskForm.reset({ title: "", category: "other" });
    }
    setCreatingTask(false);
  });

  const handleToggleTask = async (task: DailyTask) => {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("daily_tasks")
      .update({ done: !task.done, updated_by: user?.id ?? null })
      .eq("id", task.id);
  };

  const handleDeleteTask = async (taskId: string) => {
    const supabase = createBrowserSupabaseClient();
    await supabase.from("daily_tasks").delete().eq("id", taskId);
  };

  const handleSaveStats = statsForm.handleSubmit(async (values) => {
    setSavingStats(true);
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("daily_stats").upsert({
      id: stat?.id,
      date: dateKey,
      inquiry_count: values.inquiry_count,
      rfq_sent: values.rfq_sent,
      new_products: values.new_products,
      orders_closed: values.orders_closed,
      notes: values.notes || null,
      created_by: stat?.created_by ?? user?.id ?? null,
      updated_by: user?.id ?? null,
    });

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
        <p className="text-sm text-muted-foreground">每天打开页面自动补齐固定任务，再把自定义任务和当日数据补完整。</p>
      </section>

      <section className="flex flex-col gap-4 rounded-[1.75rem] border bg-white/90 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setDate((current) => addDays(current, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">当前查看日期</p>
            <p className="text-xl font-semibold">{formatDate(date)}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setDate((current) => addDays(current, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-full max-w-md space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>完成进度</span>
            <span className="font-medium">
              已完成 {completedCount} / 总计 {tasks.length} 项
            </span>
          </div>
          <Progress value={progressValue} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>任务列表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {groupedTasks.map((group) => (
                <div key={group.value} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{group.label}</p>
                    <span className="text-xs text-muted-foreground">{group.items.length} 项</span>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((task) => (
                      <div key={task.id} className="flex items-center justify-between rounded-2xl border bg-white/60 p-4">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={task.done} onChange={() => handleToggleTask(task)} />
                          <div>
                            <p className={task.done ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"}>
                              {task.title}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {task.is_template ? "固定任务" : "自定义任务"}
                            </p>
                          </div>
                        </div>
                        {!task.is_template ? (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>添加自定义任务</CardTitle>
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
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSaveStats}>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumericField label="今日询盘数" inputProps={statsForm.register("inquiry_count", { valueAsNumber: true })} />
                <NumericField label="RFQ报价发送数" inputProps={statsForm.register("rfq_sent", { valueAsNumber: true })} />
                <NumericField label="新发品数" inputProps={statsForm.register("new_products", { valueAsNumber: true })} />
                <NumericField label="成交订单数" inputProps={statsForm.register("orders_closed", { valueAsNumber: true })} />
              </div>
              <div>
                <Label className="mb-2 block">今日备注</Label>
                <Textarea placeholder="记录今天的重要情况、问题或亮点" {...statsForm.register("notes")} />
              </div>
              <Button type="submit" disabled={savingStats}>
                {savingStats ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                保存今日数据
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
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
