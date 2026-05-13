"use client";

import { AlertCircle, Copy, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EnvNotice } from "@/components/shared/env-notice";
import { hasSupabaseEnv } from "@/lib/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { Json, QuickQuoteReply } from "@/types/database";

type QuoteItem = {
  id: string;
  productName: string;
  pcsPerUnit: string;
  unitPrice: string;
  qty: string;
};

type StoredQuoteItem = {
  productName: string;
  pcsPerUnit: number | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
};

const defaultItems: QuoteItem[] = [
  { id: "400mm-chain", productName: "400mm chain", pcsPerUnit: "2", unitPrice: "2.23", qty: "6000" },
  { id: "800mm-chain", productName: "800mm chain", pcsPerUnit: "4", unitPrice: "4.64", qty: "10000" },
];

const emptyItem = (): QuoteItem => ({
  id: crypto.randomUUID(),
  productName: "",
  pcsPerUnit: "",
  unitPrice: "",
  qty: "",
});

const defaultForm = {
  title: "400mm chain + 800mm chain quote",
  packaging: "Individual poly bag",
  productionTime: "14-20 Days",
  airShippingCost: "15452",
  airShippingTime: "7-20 Days",
  seaShippingCost: "4622",
  seaShippingTime: "55-75 Days",
  internalNote: "",
};

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits,
  }).format(value);
}

function formatUnitPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

function normalizeItems(items: QuoteItem[]): StoredQuoteItem[] {
  return items
    .map((item) => {
      const unitPrice = toNumber(item.unitPrice);
      const qty = toNumber(item.qty);
      const pcsPerUnit = item.pcsPerUnit.trim() ? toNumber(item.pcsPerUnit) : null;

      return {
        productName: item.productName.trim(),
        pcsPerUnit,
        unitPrice,
        qty,
        lineTotal: unitPrice * qty,
      };
    })
    .filter((item) => item.productName || item.unitPrice > 0 || item.qty > 0);
}

function buildQuoteText({
  items,
  packaging,
  productionTime,
  airShippingCost,
  airShippingTime,
  seaShippingCost,
  seaShippingTime,
}: {
  items: StoredQuoteItem[];
  packaging: string;
  productionTime: string;
  airShippingCost: number;
  airShippingTime: string;
  seaShippingCost: number;
  seaShippingTime: string;
}) {
  const productTotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const airTotal = productTotal + airShippingCost;
  const seaTotal = productTotal + seaShippingCost;
  const divider = "════════════════════════════════════════";
  const quoteLines = ["QUOTATION", divider];
  const completeItems = items.filter((item) => item.productName && item.unitPrice > 0 && item.qty > 0);

  if (completeItems.length) {
    quoteLines.push(
      "",
      "UNIT PRICE & QUANTITY",
      ...completeItems.map((item) => {
        const unitText = item.pcsPerUnit ? ` (${formatMoney(item.pcsPerUnit, 0)} pcs/unit)` : "";
        return `• ${item.productName}${unitText} : $${formatUnitPrice(item.unitPrice)} USD × ${formatMoney(item.qty, 0)} pcs`;
      }),
    );
  }

  if (packaging.trim()) {
    quoteLines.push("", "PACKAGING", `• ${packaging.trim()}`);
  }

  if (productionTime.trim()) {
    quoteLines.push("", `PRODUCTION TIME: ${productionTime.trim()}`);
  }

  if (completeItems.length) {
    quoteLines.push(
      "",
      "PRODUCT COST",
      ...completeItems.map((item) => `  $${formatUnitPrice(item.unitPrice)} × ${formatMoney(item.qty, 0)} = $${formatMoney(item.lineTotal)}`),
      `  Subtotal: $${formatMoney(productTotal)}`,
    );
  }

  const hasAirShipping = airShippingCost > 0 || airShippingTime.trim();
  const hasSeaShipping = seaShippingCost > 0 || seaShippingTime.trim();

  if (hasAirShipping || hasSeaShipping) {
    quoteLines.push("", "SHIPPING COST (Door to Door)");
    if (hasAirShipping) {
      const airDetails = [airShippingCost > 0 ? `$${formatMoney(airShippingCost)}` : "", airShippingTime.trim() ? `Shipping Time: ${airShippingTime.trim()}` : ""].filter(Boolean);
      quoteLines.push(`  ✈ Air freight: ${airDetails.join("  |  ")}`);
    }
    if (hasSeaShipping) {
      const seaDetails = [seaShippingCost > 0 ? `$${formatMoney(seaShippingCost)}` : "", seaShippingTime.trim() ? `Shipping Time: ${seaShippingTime.trim()}` : ""].filter(Boolean);
      quoteLines.push(`  🚢 Sea freight: ${seaDetails.join("  |  ")}`);
    }
  }

  if (completeItems.length && (airShippingCost > 0 || seaShippingCost > 0)) {
    quoteLines.push("", "TOTAL COST");
    if (airShippingCost > 0) {
      quoteLines.push(`  ✈ By Air: $${formatMoney(productTotal)} + $${formatMoney(airShippingCost)} = $${formatMoney(airTotal)}`);
    }
    if (seaShippingCost > 0) {
      quoteLines.push(`  🚢 By Sea: $${formatMoney(productTotal)} + $${formatMoney(seaShippingCost)} = $${formatMoney(seaTotal)}`);
    }
  }

  return { productTotal, airTotal, seaTotal, quoteText: quoteLines.join("\n") };
}

function itemsFromRecord(record: QuickQuoteReply): QuoteItem[] {
  if (!Array.isArray(record.items)) return defaultItems;

  return record.items.map((item, index) => {
    const value = item as Record<string, Json | undefined>;
    return {
      id: `${record.id}-${index}`,
      productName: String(value.productName ?? ""),
      pcsPerUnit: String(value.pcsPerUnit ?? ""),
      unitPrice: String(value.unitPrice ?? ""),
      qty: String(value.qty ?? ""),
    };
  });
}

export function QuickQuoteClient() {
  const [items, setItems] = useState<QuoteItem[]>(defaultItems);
  const [form, setForm] = useState(defaultForm);
  const [records, setRecords] = useState<QuickQuoteReply[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculated = useMemo(() => {
    return buildQuoteText({
      items: normalizeItems(items),
      packaging: form.packaging,
      productionTime: form.productionTime,
      airShippingCost: toNumber(form.airShippingCost),
      airShippingTime: form.airShippingTime,
      seaShippingCost: toNumber(form.seaShippingCost),
      seaShippingTime: form.seaShippingTime,
    });
  }, [form.airShippingCost, form.airShippingTime, form.packaging, form.productionTime, form.seaShippingCost, form.seaShippingTime, items]);

  const loadRecords = useCallback(async () => {
    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const { data, error: loadError } = await supabase
      .from("quick_quote_replies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (loadError) {
      setError(`历史记录加载失败：${loadError.message}`);
      return;
    }

    setRecords((data ?? []) as QuickQuoteReply[]);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const updateForm = (key: keyof typeof defaultForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (id: string, key: keyof Omit<QuoteItem, "id">, value: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const addProduct = () => {
    setItems((current) => [...current, emptyItem()]);
  };

  const removeProduct = (id: string) => {
    setItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
  };

  const copyQuote = async () => {
    await navigator.clipboard.writeText(calculated.quoteText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const saveQuote = async () => {
    const quoteItems = normalizeItems(items);

    if (!quoteItems.length) {
      setError("请至少填写 1 个产品。");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      user_id: user?.id ?? null,
      title: form.title.trim() || quoteItems.map((item) => item.productName).join(" + "),
      items: quoteItems as unknown as Json,
      packaging: form.packaging.trim(),
      production_time: form.productionTime.trim(),
      air_shipping_cost: toNumber(form.airShippingCost),
      air_shipping_time: form.airShippingTime.trim(),
      sea_shipping_cost: toNumber(form.seaShippingCost),
      sea_shipping_time: form.seaShippingTime.trim(),
      product_total: calculated.productTotal,
      air_total: calculated.airTotal,
      sea_total: calculated.seaTotal,
      quote_text: calculated.quoteText,
      internal_note: form.internalNote.trim() || null,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    };

    const { data, error: saveError } = selectedId
      ? await supabase.from("quick_quote_replies").update(payload).eq("id", selectedId).select("*").single()
      : await supabase.from("quick_quote_replies").insert(payload).select("*").single();

    if (saveError) {
      setError(`保存失败：${saveError.message}`);
    } else {
      setSelectedId((data as QuickQuoteReply).id);
      await loadRecords();
    }

    setSaving(false);
  };

  const loadRecord = (record: QuickQuoteReply) => {
    setSelectedId(record.id);
    setItems(itemsFromRecord(record));
    setForm({
      title: record.title,
      packaging: record.packaging,
      productionTime: record.production_time,
      airShippingCost: String(record.air_shipping_cost),
      airShippingTime: record.air_shipping_time,
      seaShippingCost: String(record.sea_shipping_cost),
      seaShippingTime: record.sea_shipping_time,
      internalNote: record.internal_note ?? "",
    });
    setError(null);
  };

  const deleteRecord = async (recordId: string) => {
    setDeletingId(recordId);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: deleteError } = await supabase.from("quick_quote_replies").delete().eq("id", recordId);

    if (deleteError) {
      setError(`删除失败：${deleteError.message}`);
    } else {
      if (selectedId === recordId) {
        setSelectedId(null);
      }
      await loadRecords();
    }

    setDeletingId(null);
  };

  const resetDraft = () => {
    setSelectedId(null);
    setItems(defaultItems);
    setForm(defaultForm);
    setError(null);
  };

  if (!hasSupabaseEnv()) {
    return <EnvNotice />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge>报价工具</Badge>
          <h1 className="text-3xl font-semibold">快捷报价回复</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            填价格、数量、包装和运费，自动生成英文报价回复。历史记录会保存到 Supabase，方便之后继续修改和复制。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={resetDraft}>
            <RefreshCw className="mr-2 h-4 w-4" />
            新报价
          </Button>
          <Button onClick={() => void copyQuote()}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? "已复制" : "复制报价"}
          </Button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>报价输入</CardTitle>
                  <CardDescription>产品行可以随时增加或删除，右侧预览会自动刷新。</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addProduct}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add product
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="报价标题">
                <Input value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
              </Field>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const lineTotal = toNumber(item.unitPrice) * toNumber(item.qty);

                  return (
                    <div key={item.id} className="rounded-2xl border bg-secondary/30 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Product {index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeProduct(item.id)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(110px,0.6fr)_minmax(120px,0.7fr)_minmax(120px,0.7fr)]">
                        <Field label="Product name">
                          <Input value={item.productName} onChange={(event) => updateItem(item.id, "productName", event.target.value)} />
                        </Field>
                        <Field label="Pcs/unit">
                          <Input
                            inputMode="numeric"
                            placeholder="可选"
                            value={item.pcsPerUnit}
                            onChange={(event) => updateItem(item.id, "pcsPerUnit", event.target.value)}
                          />
                        </Field>
                        <Field label="Unit price USD">
                          <Input
                            inputMode="decimal"
                            value={item.unitPrice}
                            onChange={(event) => updateItem(item.id, "unitPrice", event.target.value)}
                          />
                        </Field>
                        <Field label="Qty">
                          <Input inputMode="numeric" value={item.qty} onChange={(event) => updateItem(item.id, "qty", event.target.value)} />
                        </Field>
                      </div>
                      <p className="mt-3 text-right text-sm text-muted-foreground">
                        Line total: <span className="font-semibold text-foreground">{formatMoney(lineTotal)} USD</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>包装、生产和运输</CardTitle>
              <CardDescription>包装会输出为 Comes with ...，内部备注只保存在历史里。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Packaging">
                  <Input value={form.packaging} onChange={(event) => updateForm("packaging", event.target.value)} />
                </Field>
                <Field label="Production time">
                  <Input value={form.productionTime} onChange={(event) => updateForm("productionTime", event.target.value)} />
                </Field>
                <Field label="Air shipping cost USD">
                  <Input
                    inputMode="decimal"
                    value={form.airShippingCost}
                    onChange={(event) => updateForm("airShippingCost", event.target.value)}
                  />
                </Field>
                <Field label="Air shipping time">
                  <Input value={form.airShippingTime} onChange={(event) => updateForm("airShippingTime", event.target.value)} />
                </Field>
                <Field label="Sea shipping cost USD">
                  <Input
                    inputMode="decimal"
                    value={form.seaShippingCost}
                    onChange={(event) => updateForm("seaShippingCost", event.target.value)}
                  />
                </Field>
                <Field label="Sea shipping time">
                  <Input value={form.seaShippingTime} onChange={(event) => updateForm("seaShippingTime", event.target.value)} />
                </Field>
              </div>
              <Field label="Internal note">
                <Textarea
                  rows={3}
                  value={form.internalNote}
                  placeholder="只保存到历史记录，不会复制给客户。"
                  onChange={(event) => updateForm("internalNote", event.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>报价预览</CardTitle>
              <CardDescription>这段英文可以直接复制给客户。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-3">
                <TotalItem label="Product" value={calculated.productTotal} />
                <TotalItem label="Air total" value={calculated.airTotal} />
                <TotalItem label="Sea total" value={calculated.seaTotal} />
              </section>

              <div className="rounded-2xl border bg-slate-950 p-4">
                <pre className="max-h-[540px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-100">{calculated.quoteText}</pre>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={() => void copyQuote()}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copied ? "已复制" : "Copy quote"}
                </Button>
                <Button onClick={() => void saveQuote()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {selectedId ? "Update quote" : "Save quote"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>历史记录</CardTitle>
              <CardDescription>最近 30 条报价回复。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {records.map((record) => (
                <div key={record.id} className="rounded-2xl border bg-white/75 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{record.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(record.created_at, "MM/dd HH:mm")}</p>
                    </div>
                    {selectedId === record.id ? <Badge>当前</Badge> : null}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <span>Product {formatMoney(record.product_total)}</span>
                    <span>Air {formatMoney(record.air_total)}</span>
                    <span>Sea {formatMoney(record.sea_total)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => loadRecord(record)}>
                      Load history item
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void deleteRecord(record.id)}
                      disabled={deletingId === record.id}
                    >
                      {deletingId === record.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {records.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">还没有保存过报价。</p> : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TotalItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-secondary/45 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{formatMoney(value)} USD</p>
    </div>
  );
}
