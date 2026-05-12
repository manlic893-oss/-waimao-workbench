"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
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
import { hasSupabaseEnv } from "@/lib/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { productKnowledgeSchema, type ProductKnowledgeFormValues } from "@/lib/validators/knowledge";
import type { ProductKnowledge } from "@/types/database";

export function ProductsKnowledgeClient() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ProductKnowledge[]>([]);
  const [search, setSearch] = useState(searchParams.get("keyword") ?? "");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<ProductKnowledge | null>(null);

  const form = useForm<ProductKnowledgeFormValues>({
    resolver: zodResolver(productKnowledgeSchema),
    defaultValues: {
      product_name: "",
      category: "",
      specs: "",
      price_range: "",
      moq: "",
      material: "",
      lead_time: "",
      notes: "",
    },
  });

  const loadItems = async () => {
    if (!hasSupabaseEnv()) return;
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.from("product_knowledge").select("*").order("updated_at", { ascending: false });
    setItems((data ?? []) as ProductKnowledge[]);
  };

  useEffect(() => {
    void loadItems();
    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("product-knowledge")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_knowledge" }, loadItems)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setSearch(searchParams.get("keyword") ?? "");
  }, [searchParams]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        !search ||
        item.product_name.toLowerCase().includes(search.toLowerCase()) ||
        (item.category ?? "").toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === "all" || (item.category ?? "") === category;
      return matchSearch && matchCategory;
    });
  }, [category, items, search]);

  const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean))) as string[];

  const openNew = () => {
    setSelected(null);
    form.reset({
      product_name: "",
      category: "",
      specs: "",
      price_range: "",
      moq: "",
      material: "",
      lead_time: "",
      notes: "",
    });
    setOpen(true);
  };

  const openEdit = (item: ProductKnowledge) => {
    setSelected(item);
    form.reset({
      product_name: item.product_name,
      category: item.category ?? "",
      specs: item.specs ?? "",
      price_range: item.price_range ?? "",
      moq: item.moq ?? "",
      material: item.material ?? "",
      lead_time: item.lead_time ?? "",
      notes: item.notes ?? "",
    });
    setOpen(true);
  };

  const handleSave = form.handleSubmit(async (values) => {
    setSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      product_name: values.product_name,
      category: values.category || null,
      specs: values.specs || null,
      price_range: values.price_range || null,
      moq: values.moq || null,
      material: values.material || null,
      lead_time: values.lead_time || null,
      notes: values.notes || null,
      updated_by: user?.id ?? null,
    };

    if (selected) {
      await supabase.from("product_knowledge").update(payload).eq("id", selected.id);
    } else {
      await supabase.from("product_knowledge").insert({
        ...payload,
        created_by: user?.id ?? null,
      });
    }

    setSubmitting(false);
    setOpen(false);
    await loadItems();
  });

  const handleDelete = async (item: ProductKnowledge) => {
    if (!window.confirm(`确定删除产品「${item.product_name}」吗？`)) return;
    const supabase = createBrowserSupabaseClient();
    await supabase.from("product_knowledge").delete().eq("id", item.id);
  };

  if (!hasSupabaseEnv()) {
    return <EnvNotice />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge>产品知识库</Badge>
          <h1 className="text-3xl font-semibold">产品知识库</h1>
          <p className="text-sm text-muted-foreground">统一沉淀产品规格、报价区间、MOQ 和生产信息，团队共用一套资料。</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          新增产品
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="按产品名或分类搜索" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Select
          options={[{ value: "all", label: "全部分类" }, ...categories.map((item) => ({ value: item, label: item }))]}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
      </section>

      <section className="grid gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} className="cursor-pointer bg-white/90" onClick={() => openEdit(item)}>
            <CardContent className="grid gap-4 p-5 md:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{item.product_name}</h3>
                  {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
                </div>
                <p className="text-sm text-slate-600">价格区间：{item.price_range || "未填写"}</p>
                <p className="text-sm text-slate-600">MOQ：{item.moq || "未填写"}</p>
                <p className="truncate text-sm text-muted-foreground">规格：{item.specs || "未填写"}</p>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>材质：{item.material || "未填写"}</p>
                <p>生产周期：{item.lead_time || "未填写"}</p>
                <p className="truncate">备注：{item.notes || "未填写"}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">暂时没有匹配的产品资料，先新增一条吧。</CardContent>
          </Card>
        ) : null}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected ? "编辑产品资料" : "新增产品资料"}</DialogTitle>
            <DialogDescription>保存后团队成员都可以在知识库里查看和继续维护。</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSave}>
            <Field label="产品名称">
              <Input {...form.register("product_name")} />
            </Field>
            <Field label="产品分类">
              <Input {...form.register("category")} />
            </Field>
            <Field label="价格区间">
              <Input {...form.register("price_range")} />
            </Field>
            <Field label="MOQ">
              <Input {...form.register("moq")} />
            </Field>
            <Field label="材质">
              <Input {...form.register("material")} />
            </Field>
            <Field label="生产周期">
              <Input {...form.register("lead_time")} />
            </Field>
            <Field className="md:col-span-2" label="规格/尺寸">
              <Textarea rows={5} {...form.register("specs")} />
            </Field>
            <Field className="md:col-span-2" label="备注">
              <Textarea rows={4} {...form.register("notes")} />
            </Field>
            <DialogFooter className="md:col-span-2">
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
