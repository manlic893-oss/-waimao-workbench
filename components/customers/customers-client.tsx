"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageSquarePlus, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { CUSTOMER_GRADES, CUSTOMER_SOURCES, CUSTOMER_STATUSES, GRADE_STYLES, STATUS_STYLES } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { customerLogSchema, customerSchema, type CustomerFormValues, type CustomerLogValues } from "@/lib/validators/customer";
import { formatDate, getInitials, isDueToday, isDueTodayOrOverdue } from "@/lib/utils";
import type { Customer, CustomerLog } from "@/types/database";
import { EnvNotice } from "@/components/shared/env-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FilterKey = "all" | "new" | "follow" | "sample" | "closed" | "grade-a" | "due-today";

const filterLabels: Record<FilterKey, string> = {
  all: "全部",
  new: "新询盘",
  follow: "跟进中",
  sample: "寄样中",
  closed: "已成交",
  "grade-a": "A类客户",
  "due-today": "今日需跟进",
};

export function CustomersClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logs, setLogs] = useState<CustomerLog[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      country: "",
      source: "",
      grade: "B",
      status: "new",
      whatsapp: "",
      email: "",
      product: "",
      next_follow_date: "",
      notes: "",
    },
  });

  const logForm = useForm<CustomerLogValues>({
    resolver: zodResolver(customerLogSchema),
    defaultValues: { content: "" },
  });

  const loadCustomers = useCallback(async () => {
    if (!hasSupabaseEnv()) {
      setLoading(false);
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const [customersResult, logsResult] = await Promise.all([
      supabase.from("customers").select("*").order("updated_at", { ascending: false }),
      supabase.from("customer_logs").select("*").order("created_at", { ascending: false }),
    ]);

    if (!customersResult.error) {
      setCustomers(customersResult.data ?? []);
    }

    if (!logsResult.error) {
      setLogs(logsResult.data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadCustomers();

    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("customers-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, loadCustomers)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_logs" }, loadCustomers)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadCustomers]);

  const stats = useMemo(() => {
    const dueCount = customers.filter((customer) => isDueTodayOrOverdue(customer.next_follow_date)).length;
    const gradeACount = customers.filter((customer) => customer.grade === "A").length;
    const closedCount = customers.filter((customer) => customer.status === "closed").length;

    return {
      total: customers.length,
      dueCount,
      gradeACount,
      closedCount,
    };
  }, [customers]);

  const sortedCustomers = useMemo(() => {
    const gradeOrder = { A: 0, B: 1, C: 2, null: 3 } as const;

    return [...customers]
      .filter((customer) => {
        switch (activeFilter) {
          case "new":
            return customer.status === "new";
          case "follow":
            return customer.status === "follow";
          case "sample":
            return customer.status === "sample";
          case "closed":
            return customer.status === "closed";
          case "grade-a":
            return customer.grade === "A";
          case "due-today":
            return isDueTodayOrOverdue(customer.next_follow_date);
          default:
            return true;
        }
      })
      .sort((a, b) => {
        const aDue = isDueTodayOrOverdue(a.next_follow_date) ? 0 : 1;
        const bDue = isDueTodayOrOverdue(b.next_follow_date) ? 0 : 1;
        const gradeA = gradeOrder[a.grade ?? "null"];
        const gradeB = gradeOrder[b.grade ?? "null"];

        return aDue - bDue || gradeA - gradeB || b.updated_at.localeCompare(a.updated_at);
      });
  }, [activeFilter, customers]);

  const activeLogs = logs.filter((item) => item.customer_id === selectedCustomer?.id);
  const dueTodayCustomers = customers.filter((customer) => isDueTodayOrOverdue(customer.next_follow_date));

  const resetCustomerForm = (customer?: Customer | null) => {
    customerForm.reset({
      name: customer?.name ?? "",
      country: customer?.country ?? "",
      source: customer?.source ?? "",
      grade: customer?.grade ?? "B",
      status: customer?.status ?? "new",
      whatsapp: customer?.whatsapp ?? "",
      email: customer?.email ?? "",
      product: customer?.product ?? "",
      next_follow_date: customer?.next_follow_date ?? "",
      notes: customer?.notes ?? "",
    });
  };

  const openNewCustomer = () => {
    setSelectedCustomer(null);
    resetCustomerForm(null);
    setFormOpen(true);
  };

  const openEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    resetCustomerForm(customer);
    setFormOpen(true);
  };

  const handleSaveCustomer = customerForm.handleSubmit(async (values) => {
    const supabase = createBrowserSupabaseClient();
    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        ...values,
        email: values.email || null,
        country: values.country || null,
        source: (values.source || null) as Customer["source"],
        grade: (values.grade || null) as Customer["grade"],
        status: (values.status || null) as Customer["status"],
        whatsapp: values.whatsapp || null,
        product: values.product || null,
        next_follow_date: values.next_follow_date || null,
        notes: values.notes || null,
        updated_by: user?.id ?? null,
      };

      if (selectedCustomer) {
        const { error } = await supabase.from("customers").update(payload).eq("id", selectedCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({
          ...payload,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }

      setFormOpen(false);
      await loadCustomers();
    } finally {
      setSubmitting(false);
    }
  });

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!window.confirm(`确定删除客户「${customer.name}」吗？此操作会一并删除沟通记录。`)) {
      return;
    }

    const supabase = createBrowserSupabaseClient();
    await supabase.from("customers").delete().eq("id", customer.id);
    if (selectedCustomer?.id === customer.id) {
      setDetailOpen(false);
      setSelectedCustomer(null);
    }
  };

  const handleAddLog = logForm.handleSubmit(async (values) => {
    if (!selectedCustomer) return;
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("customer_logs").insert({
      customer_id: selectedCustomer.id,
      content: values.content,
      created_by: user?.id ?? null,
    });

    if (!error) {
      logForm.reset({ content: "" });
      await loadCustomers();
    }
  });

  if (!hasSupabaseEnv()) {
    return <EnvNotice />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge>客户跟进管理</Badge>
          <h1 className="text-3xl font-semibold">客户 CRM</h1>
          <p className="text-sm text-muted-foreground">把今天需要优先跟进的客户顶到前面，让工作节奏更清晰。</p>
        </div>
        <Button onClick={openNewCustomer}>
          <Plus className="mr-2 h-4 w-4" />
          新增客户
        </Button>
      </section>

      {dueTodayCustomers.length > 0 ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          今天有 <span className="font-semibold">{dueTodayCustomers.length}</span> 位客户需要跟进，建议优先处理。
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="总客户数" value={stats.total} />
        <StatCard title="今日需跟进" value={stats.dueCount} accent="rose" />
        <StatCard title="A 类客户数" value={stats.gradeACount} accent="emerald" />
        <StatCard title="已成交数" value={stats.closedCount} accent="indigo" />
      </section>

      <section className="flex flex-wrap gap-2">
        {(Object.keys(filterLabels) as FilterKey[]).map((key) => (
          <Button
            key={key}
            variant={activeFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(key)}
          >
            {filterLabels[key]}
          </Button>
        ))}
      </section>

      <section className="grid gap-4">
        {sortedCustomers.map((customer) => (
          <Card
            key={customer.id}
            className="cursor-pointer bg-white/90 transition-transform hover:-translate-y-0.5"
            onClick={() => {
              setSelectedCustomer(customer);
              setDetailOpen(true);
            }}
          >
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold ${
                    customer.grade === "A"
                      ? "bg-emerald-100 text-emerald-700"
                      : customer.grade === "B"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {getInitials(customer.name)}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{customer.name}</h3>
                    {customer.grade ? <Badge className={GRADE_STYLES[customer.grade]}>{customer.grade}类</Badge> : null}
                    {customer.status ? (
                      <Badge className={STATUS_STYLES[customer.status]}>
                        {CUSTOMER_STATUSES.find((item) => item.value === customer.status)?.label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {customer.country || "未填写国家"} · {customer.source || "未填写来源"}
                  </p>
                  <p className="max-w-2xl text-sm text-slate-600">{customer.product || "暂无产品需求描述"}</p>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                {customer.next_follow_date ? (
                  <div
                    className={`rounded-full px-3 py-1 text-sm ${
                      isDueTodayOrOverdue(customer.next_follow_date) ? "bg-rose-100 text-rose-700" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    下次跟进：{formatDate(customer.next_follow_date)}
                    {isDueToday(customer.next_follow_date) ? " · 今日需跟进" : null}
                  </div>
                ) : (
                  <div className="rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground">未设置跟进日期</div>
                )}
                {customer.whatsapp ? (
                  <div className="inline-flex items-center gap-2 text-sm text-emerald-700">
                    <Phone className="h-4 w-4" />
                    WhatsApp
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {!loading && sortedCustomers.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">当前筛选下暂无客户，先新增一位客户开始跟进吧。</CardContent>
        </Card>
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCustomer ? "编辑客户" : "新增客户"}</DialogTitle>
            <DialogDescription>保存后列表会实时刷新，团队成员也能同步看到最新状态。</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveCustomer}>
            <Field label="客户名">
              <Input {...customerForm.register("name")} />
              <ErrorText message={customerForm.formState.errors.name?.message} />
            </Field>
            <Field label="国家">
              <Input {...customerForm.register("country")} />
            </Field>
            <Field label="询盘来源">
              <Select
                options={CUSTOMER_SOURCES.map((item) => ({ value: item, label: item }))}
                placeholder="请选择来源"
                {...customerForm.register("source")}
              />
            </Field>
            <Field label="意向评级">
              <Select
                options={CUSTOMER_GRADES.map((item) => ({ value: item, label: item }))}
                placeholder="请选择评级"
                {...customerForm.register("grade")}
              />
            </Field>
            <Field label="WhatsApp">
              <Input {...customerForm.register("whatsapp")} />
            </Field>
            <Field label="邮箱">
              <Input type="email" {...customerForm.register("email")} />
              <ErrorText message={customerForm.formState.errors.email?.message} />
            </Field>
            <Field label="跟进状态">
              <Select
                options={CUSTOMER_STATUSES.map((item) => ({ value: item.value, label: item.label }))}
                placeholder="请选择状态"
                {...customerForm.register("status")}
              />
            </Field>
            <Field label="下次跟进日期">
              <Input type="date" {...customerForm.register("next_follow_date")} />
            </Field>
            <Field label="产品需求" className="md:col-span-2">
              <Textarea {...customerForm.register("product")} />
            </Field>
            <Field label="长期备注" className="md:col-span-2">
              <Textarea {...customerForm.register("notes")} />
            </Field>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                保存客户
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl">
          {selectedCustomer ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedCustomer.name}</DialogTitle>
                <DialogDescription>客户完整信息与最新沟通记录都集中在这里。</DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">客户信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <InfoRow label="国家" value={selectedCustomer.country} />
                    <InfoRow label="来源" value={selectedCustomer.source} />
                    <InfoRow label="评级" value={selectedCustomer.grade} />
                    <InfoRow
                      label="状态"
                      value={CUSTOMER_STATUSES.find((item) => item.value === selectedCustomer.status)?.label}
                    />
                    <InfoRow label="WhatsApp" value={selectedCustomer.whatsapp} />
                    <InfoRow label="邮箱" value={selectedCustomer.email} />
                    <InfoRow label="下次跟进日期" value={selectedCustomer.next_follow_date ? formatDate(selectedCustomer.next_follow_date) : null} />
                    <InfoRow label="产品需求" value={selectedCustomer.product} />
                    <InfoRow label="长期备注" value={selectedCustomer.notes} />

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDetailOpen(false);
                          openEditCustomer(selectedCustomer);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </Button>
                      <Button variant="destructive" onClick={() => handleDeleteCustomer(selectedCustomer)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">沟通记录</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {activeLogs.length > 0 ? (
                        activeLogs.map((log) => (
                          <div key={log.id} className="rounded-2xl border bg-white/60 p-4">
                            <p className="text-sm leading-6">{log.content}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{formatDate(log.created_at, "yyyy年MM月dd日 HH:mm")}</p>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">还没有沟通记录，先记下今天的跟进情况。</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MessageSquarePlus className="h-4 w-4" />
                        添加沟通记录
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-3" onSubmit={handleAddLog}>
                        <Textarea placeholder="记录本次跟进内容、客户反馈和下一步动作" {...logForm.register("content")} />
                        <ErrorText message={logForm.formState.errors.content?.message} />
                        <div className="flex justify-end">
                          <Button type="submit">记录</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  title,
  value,
  accent = "slate",
}: {
  title: string;
  value: number;
  accent?: "slate" | "rose" | "emerald" | "indigo";
}) {
  const styles = {
    slate: "bg-slate-100 text-slate-700",
    rose: "bg-rose-100 text-rose-700",
    emerald: "bg-emerald-100 text-emerald-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-3 text-3xl font-semibold">{value}</p>
        </div>
        <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${styles[accent]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      {children}
    </div>
  );
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="leading-6 text-foreground">{value || "未填写"}</p>
    </div>
  );
}
