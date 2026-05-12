"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { EnvNotice } from "@/components/shared/env-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KNOWLEDGE_ARTICLE_CATEGORIES } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { knowledgeArticleSchema, type KnowledgeArticleFormValues } from "@/lib/validators/knowledge";
import type { KnowledgeArticle } from "@/types/database";

export function PersonalKnowledgeClient() {
  const [items, setItems] = useState<KnowledgeArticle[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [selected, setSelected] = useState<KnowledgeArticle | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const form = useForm<KnowledgeArticleFormValues>({
    resolver: zodResolver(knowledgeArticleSchema),
    defaultValues: {
      title: "",
      url: "",
      content: "",
      summary: "",
      tags: "",
      category: "other",
    },
  });

  const loadItems = async () => {
    if (!hasSupabaseEnv()) return;
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;

    const { data } = await supabase
      .from("knowledge_articles")
      .select("*")
      .or(`user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as KnowledgeArticle[]);
  };

  useEffect(() => {
    void loadItems();
    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("personal-knowledge")
      .on("postgres_changes", { event: "*", schema: "public", table: "knowledge_articles" }, loadItems)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const tags = item.tags?.join(",") ?? "";
      const keyword = search.toLowerCase();
      const matchSearch =
        !search ||
        item.title.toLowerCase().includes(keyword) ||
        (item.summary ?? "").toLowerCase().includes(keyword) ||
        tags.toLowerCase().includes(keyword);
      const matchCategory = category === "all" || item.category === category;
      return matchSearch && matchCategory;
    });
  }, [category, items, search]);

  const openNew = () => {
    setSelected(null);
    form.reset({
      title: "",
      url: "",
      content: "",
      summary: "",
      tags: "",
      category: "other",
    });
    setOpen(true);
  };

  const openEdit = (item: KnowledgeArticle) => {
    setSelected(item);
    form.reset({
      title: item.title,
      url: item.url ?? "",
      content: item.content ?? "",
      summary: item.summary ?? "",
      tags: item.tags?.join("、") ?? "",
      category: item.category ?? "other",
    });
    setOpen(true);
  };

  const handleExtract = async () => {
    const url = form.getValues("url");
    if (!url) return;
    setExtracting(true);
    const response = await fetch("/api/extract-article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = (await response.json()) as { title?: string; summary?: string };
    if (data.title) form.setValue("title", data.title);
    if (data.summary) form.setValue("summary", data.summary);
    setExtracting(false);
  };

  const handleSave = form.handleSubmit(async (values) => {
    setSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;

    const payload = {
      user_id: user.id,
      title: values.title,
      url: values.url || null,
      content: values.content || null,
      summary: values.summary || null,
      tags: values.tags
        ? values.tags
            .split(/[,，、]/)
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      category: values.category,
    };

    if (selected) {
      await supabase.from("knowledge_articles").update(payload).eq("id", selected.id);
    } else {
      await supabase.from("knowledge_articles").insert(payload);
    }

    setSubmitting(false);
    setOpen(false);
    await loadItems();
  });

  const handleDelete = async (item: KnowledgeArticle) => {
    if (!window.confirm(`确定删除「${item.title}」吗？`)) return;
    const supabase = createBrowserSupabaseClient();
    await supabase.from("knowledge_articles").delete().eq("id", item.id);
  };

  if (!hasSupabaseEnv()) {
    return <EnvNotice />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge>个人学习库</Badge>
          <h1 className="text-3xl font-semibold">个人学习库</h1>
          <p className="text-sm text-muted-foreground">沉淀自己的文章、链接和笔记，只对当前账号可见。</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          新增文章
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="按标题、标签或摘要搜索" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Select
          options={[{ value: "all", label: "全部分类" }, ...KNOWLEDGE_ARTICLE_CATEGORIES.map((item) => ({ value: item.value, label: item.label }))]}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
      </section>

      <section className="grid gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} className="cursor-pointer bg-white/90" onClick={() => openEdit(item)}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                {item.category ? (
                  <Badge variant="outline">{KNOWLEDGE_ARTICLE_CATEGORIES.find((option) => option.value === item.category)?.label ?? item.category}</Badge>
                ) : null}
              </div>
              <p className="text-sm text-slate-600">{item.summary?.slice(0, 80) || item.content?.slice(0, 80) || "暂无摘要"}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(item.created_at, "yyyy年MM月dd日 HH:mm")}</span>
                {item.tags?.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected ? "编辑学习内容" : "新增学习内容"}</DialogTitle>
            <DialogDescription>支持贴链接抓取，也可以手动记录自己的笔记。</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <Field label="来源链接">
                <Input {...form.register("url")} />
              </Field>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={() => void handleExtract()} disabled={extracting}>
                  {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  抓取
                </Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="标题">
                <Input {...form.register("title")} />
              </Field>
              <Field label="分类">
                <Select options={KNOWLEDGE_ARTICLE_CATEGORIES.map((item) => ({ value: item.value, label: item.label }))} {...form.register("category")} />
              </Field>
            </div>
            <Field label="摘要">
              <Textarea rows={3} {...form.register("summary")} />
            </Field>
            <Field label="正文内容 / 笔记">
              <Textarea rows={7} {...form.register("content")} />
            </Field>
            <Field label="标签">
              <Input placeholder="多个标签可用逗号、顿号分隔" {...form.register("tags")} />
            </Field>
            {selected?.url ? (
              <div className="rounded-2xl border bg-secondary/40 px-4 py-3 text-sm">
                <Link className="inline-flex items-center gap-2 text-primary" href={selected.url} target="_blank">
                  打开原文链接
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
            <DialogFooter>
              {selected ? (
                <Button type="button" variant="destructive" onClick={() => void handleDelete(selected)}>
                  删除
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      {children}
    </div>
  );
}
