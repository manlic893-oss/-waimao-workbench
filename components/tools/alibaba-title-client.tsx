"use client";

import { AlertCircle, CheckCircle2, Copy, ImagePlus, Loader2, Save, Sparkles } from "lucide-react";
import Image from "next/image";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { validateAlibabaTitle, type AlibabaTitleOption } from "@/lib/alibaba-title";
import { EnvNotice } from "@/components/shared/env-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import type { AlibabaTitleGeneration } from "@/types/database";

type RecordWithImage = AlibabaTitleGeneration & {
  imageUrl?: string;
};

type GenerateResponse = {
  record?: AlibabaTitleGeneration;
  error?: string;
  issues?: string[];
};

const emptyForm = {
  sku: "",
  confirmedMaterial: "",
  confirmedSize: "",
  confirmedUsage: "",
  referenceText: "",
  forbiddenWords: "",
};

function getTitleOptions(record: AlibabaTitleGeneration) {
  return Array.isArray(record.titles) ? (record.titles as AlibabaTitleOption[]) : [];
}

export function AlibabaTitleClient() {
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [records, setRecords] = useState<RecordWithImage[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<RecordWithImage | null>(null);
  const [confirmedTitles, setConfirmedTitles] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const loadRecords = useCallback(async () => {
    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from("alibaba_title_generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = (data ?? []) as AlibabaTitleGeneration[];
    const withImages = await Promise.all(
      rows.map(async (record) => {
        const { data: signed } = await supabase.storage
          .from("product-title-images")
          .createSignedUrl(record.image_path, 60 * 60);
        return { ...record, imageUrl: signed?.signedUrl };
      }),
    );

    setRecords(withImages);
    setConfirmedTitles(
      Object.fromEntries(withImages.map((record) => [record.id, record.confirmed_title ?? record.recommended_title ?? ""])),
    );
    setSelectedRecord((current) => {
      if (!current) return withImages[0] ?? null;
      return withImages.find((record) => record.id === current.id) ?? withImages[0] ?? null;
    });
  }, []);

  useEffect(() => {
    void loadRecords();

    if (!hasSupabaseEnv()) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("alibaba-title-generations")
      .on("postgres_changes", { event: "*", schema: "public", table: "alibaba_title_generations" }, loadRecords)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRecords]);

  const updateForm = (key: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIssues([]);

    if (!imageFile) {
      setError("请先上传产品图片。");
      return;
    }

    setGenerating(true);
    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("sku", form.sku);
    formData.append("confirmedMaterial", form.confirmedMaterial);
    formData.append("confirmedSize", form.confirmedSize);
    formData.append("confirmedUsage", form.confirmedUsage);
    formData.append("referenceText", form.referenceText);
    formData.append("forbiddenWords", form.forbiddenWords);

    try {
      const response = await fetch("/api/alibaba-title", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok || !payload.record) {
        setError(payload.error ?? "生成失败，请稍后再试。");
        setIssues(payload.issues ?? []);
        return;
      }

      setImageFile(null);
      setSelectedRecord(payload.record);
      setConfirmedTitles((current) => ({
        ...current,
        [payload.record!.id]: payload.record!.recommended_title ?? "",
      }));
      await loadRecords();
    } catch {
      setError("生成失败，请检查网络或 API 配置。");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (text: string | null) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const handleConfirm = async (record: AlibabaTitleGeneration) => {
    const title = confirmedTitles[record.id] ?? "";
    const check = validateAlibabaTitle(title, record.forbidden_words);

    if (!check.passed) {
      setError(`人工确认标题不合规：${check.issues.join("，")}`);
      return;
    }

    setSavingId(record.id);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: saveError } = await supabase
      .from("alibaba_title_generations")
      .update({
        confirmed_title: check.title,
        status: "confirmed",
        updated_by: user?.id ?? null,
      })
      .eq("id", record.id);

    if (saveError) {
      setError(`保存失败：${saveError.message}`);
    } else {
      await loadRecords();
    }

    setSavingId(null);
  };

  if (!hasSupabaseEnv()) {
    return <EnvNotice />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge>AI 工具</Badge>
          <h1 className="text-3xl font-semibold">Alibaba 产品标题生成</h1>
          <p className="text-sm text-muted-foreground">
            上传水晶灯饰配件图片，自动识别产品关键词并生成不超过 128 个英文字符且无标点的标题。
          </p>
          <p className="text-xs text-muted-foreground">
            如果当前使用 DeepSeek Key，请在参考关键词中补充产品描述或同行标题，因为 DeepSeek 模式暂不直接识别图片。
          </p>
        </div>
        <Button variant="outline" onClick={() => selectedRecord?.recommended_title && void handleCopy(selectedRecord.recommended_title)}>
          <Copy className="mr-2 h-4 w-4" />
          复制推荐标题
        </Button>
      </section>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{error}</p>
              {issues.length ? <p className="mt-1 text-xs">{issues.join("；")}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>生成输入</CardTitle>
            <CardDescription>只需要上传图片，其余字段用于提高识别和标题准确度。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleGenerate}>
              <div className="space-y-2">
                <Label>产品图片</Label>
                <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-secondary/40 px-4 py-6 text-center transition-colors hover:bg-secondary">
                  <ImagePlus className="mb-3 h-8 w-8 text-primary" />
                  <span className="text-sm font-medium">{imageFile ? imageFile.name : "点击上传 PNG JPG JPEG 或 WEBP"}</span>
                  <span className="mt-1 text-xs text-muted-foreground">最大 8MB</span>
                  <Input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <Field label="SKU 可选">
                  <Input value={form.sku} onChange={(event) => updateForm("sku", event.target.value)} />
                </Field>
                <Field label="确认材质 可选">
                  <Input placeholder="例如 K9 crystal" value={form.confirmedMaterial} onChange={(event) => updateForm("confirmedMaterial", event.target.value)} />
                </Field>
                <Field label="确认尺寸 可选">
                  <Input placeholder="例如 38 mm" value={form.confirmedSize} onChange={(event) => updateForm("confirmedSize", event.target.value)} />
                </Field>
                <Field label="确认用途 可选">
                  <Input placeholder="例如 chandelier decoration" value={form.confirmedUsage} onChange={(event) => updateForm("confirmedUsage", event.target.value)} />
                </Field>
              </div>

              <Field label="参考关键词或参考标题 可选">
                <Textarea
                  rows={4}
                  placeholder="粘贴产品描述 同行标题或关键词 DeepSeek 模式必须填写这里或填写材质尺寸用途"
                  value={form.referenceText}
                  onChange={(event) => updateForm("referenceText", event.target.value)}
                />
              </Field>

              <Field label="禁止词 可选">
                <Textarea
                  rows={3}
                  placeholder="每行一个或用逗号分隔，例如 best cheapest"
                  value={form.forbiddenWords}
                  onChange={(event) => updateForm("forbiddenWords", event.target.value)}
                />
              </Field>

              <Button className="w-full" type="submit" disabled={generating}>
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                生成标题
              </Button>
            </form>
          </CardContent>
        </Card>

        <ResultPanel
          record={selectedRecord}
          confirmedTitle={selectedRecord ? confirmedTitles[selectedRecord.id] ?? "" : ""}
          saving={selectedRecord ? savingId === selectedRecord.id : false}
          onCopy={handleCopy}
          onConfirm={(record) => void handleConfirm(record)}
          onConfirmedTitleChange={(recordId, value) => setConfirmedTitles((current) => ({ ...current, [recordId]: value }))}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">历史记录</h2>
          <p className="text-sm text-muted-foreground">最近 20 条生成结果</p>
        </div>
        <div className="grid gap-3">
          {records.map((record) => (
            <button
              key={record.id}
              className="grid gap-3 rounded-2xl border bg-white/85 p-4 text-left transition-colors hover:bg-secondary/50 md:grid-cols-[88px_1fr_auto]"
              type="button"
              onClick={() => setSelectedRecord(record)}
            >
              {record.imageUrl ? (
                <Image className="rounded-xl object-cover" src={record.imageUrl} alt="产品图片" width={80} height={80} unoptimized />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-secondary text-xs text-muted-foreground">无预览</div>
              )}
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={record.status === "confirmed" ? "default" : "outline"}>{record.status === "confirmed" ? "已确认" : "已生成"}</Badge>
                  {record.sku ? <span className="text-xs text-muted-foreground">SKU {record.sku}</span> : null}
                </div>
                <p className="truncate text-sm font-medium">{record.recommended_title ?? "未生成推荐标题"}</p>
                <p className="truncate text-xs text-muted-foreground">{record.product_identification ?? "未识别产品"}</p>
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(record.created_at, "MM/dd HH:mm")}</p>
            </button>
          ))}
          {records.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">还没有生成记录，先上传一张产品图试试。</CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ResultPanel({
  record,
  confirmedTitle,
  saving,
  onCopy,
  onConfirm,
  onConfirmedTitleChange,
}: {
  record: RecordWithImage | null;
  confirmedTitle: string;
  saving: boolean;
  onCopy: (text: string | null) => Promise<void>;
  onConfirm: (record: AlibabaTitleGeneration) => void;
  onConfirmedTitleChange: (recordId: string, value: string) => void;
}) {
  if (!record) {
    return (
      <Card>
        <CardContent className="flex min-h-[520px] items-center justify-center p-10 text-center text-sm text-muted-foreground">
          上传产品图片后，这里会显示识别结果、关键词和 3 个合规标题。
        </CardContent>
      </Card>
    );
  }

  const titles = getTitleOptions(record);
  const confirmedCheck = validateAlibabaTitle(confirmedTitle, record.forbidden_words);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>生成结果</CardTitle>
            <CardDescription>{formatDate(record.created_at, "yyyy/MM/dd HH:mm")}</CardDescription>
          </div>
          {record.imageUrl ? (
            <Image className="rounded-2xl object-cover" src={record.imageUrl} alt="产品图片预览" width={96} height={96} unoptimized />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="grid gap-3 md:grid-cols-3">
          <InfoItem label="识别品类" value={record.product_identification} />
          <InfoItem label="材质线索" value={record.possible_material} />
          <InfoItem label="形状风格" value={record.shape_or_style} />
        </section>

        <KeywordBlock label="推荐关键词" items={record.recommended_keywords} />
        <KeywordBlock label="不建议关键词" items={record.keywords_to_avoid} muted />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">标题候选</h3>
          {titles.map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-2xl border bg-secondary/35 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Badge variant={item.passed ? "default" : "destructive"}>{item.passed ? "合规" : "需修改"}</Badge>
                <span className="text-xs text-muted-foreground">{item.characterCount} 字符</span>
              </div>
              <p className="text-sm font-medium">{item.title}</p>
              {item.issues.length ? <p className="mt-2 text-xs text-destructive">{item.issues.join("，")}</p> : null}
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">推荐标题</h3>
          </div>
          <p className="text-base font-semibold">{record.recommended_title}</p>
          <p className="mt-2 text-xs text-muted-foreground">{record.reason}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void onCopy(record.recommended_title)}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              复制
            </Button>
          </div>
        </section>

        {record.risk_check.length ? <KeywordBlock label="风险检查" items={record.risk_check} muted /> : null}

        <section className="space-y-2">
          <Label>人工确认标题</Label>
          <Textarea value={confirmedTitle} rows={3} onChange={(event) => onConfirmedTitleChange(record.id, event.target.value)} />
          <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span className={confirmedCheck.passed ? "text-emerald-600" : "text-destructive"}>
              {confirmedCheck.passed ? `合规 ${confirmedCheck.characterCount} 字符` : confirmedCheck.issues.join("，")}
            </span>
            <Button size="sm" onClick={() => onConfirm(record)} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
              保存确认标题
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border bg-white/75 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value || "未识别"}</p>
    </div>
  );
}

function KeywordBlock({ label, items, muted = false }: { label: string; items: string[]; muted?: boolean }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <Badge key={item} variant={muted ? "outline" : "secondary"}>
              {item}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">暂无</span>
        )}
      </div>
    </section>
  );
}
