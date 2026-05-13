"use client";

import { CheckCircle2, Copy, ImagePlus, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const simplePrompt = `I am an Alibaba.com seller of crystal chandelier lighting accessories.

Please use the uploaded product photo as the exact reference. Do not change the product shape, holes, hooks, color, quantity, size proportion, or structure.

Help me create Alibaba product image ideas and English listing content in this order:

1. Main image prompt:
Pure white background, no text, no logo, no watermark, 1:1 square image, product centered, premium commercial photography style.

2. Detail image prompts:
Crystal facet close-up, transparent material, light refraction, polished edge, hanging hole or connector detail.

3. Scene image prompts:
Luxury hotel chandelier, warm indoor lighting, high-end interior space, realistic crystal reflections.

4. Multi-angle image prompts:
Front view, side view, 45-degree view, hanging method, structure detail.

5. English Alibaba listing:
Product title, 5 bullet points, search keywords, product specifications, applications, customization options, packaging description.

If any product data is unknown, write "to be confirmed".`;

const quickSteps = [
  {
    icon: ImagePlus,
    title: "第一步：只选 1 张最清楚的图",
    text: "不要一开始整理很多图。先选一张最清楚、最像实物的供应商图，最好能看清形状、孔位和水晶切面。",
  },
  {
    icon: Copy,
    title: "第二步：复制万能提示词",
    text: "把下面这条提示词复制到 ChatGPT，然后上传那张产品图。先让 AI 给你主图、细节图、场景图、多角度图和英文资料的生成方案。",
  },
  {
    icon: ShieldCheck,
    title: "第三步：只检查 3 件事",
    text: "主图是否白底无字；产品结构是否和实物一样；英文尺寸、材质、MOQ 有没有乱写。不确定的数据就写 to be confirmed。",
  },
];

const minimumOutputs = [
  "1 张白底主图",
  "2 张细节图",
  "1 张场景图",
  "1 张挂法/结构图",
  "1 份英文标题和卖点",
];

const advancedOutputs = ["3 张细节图", "2 张场景图", "4 张多角度图", "完整英文详情页资料", "批量 SKU 表格记录"];

export function ProductImageWorkflowClient() {
  const [copied, setCopied] = useState(false);
  const [doneItems, setDoneItems] = useState<string[]>([]);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(simplePrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const toggleDone = (item: string) => {
    setDoneItems((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-8 p-6 md:p-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <Badge>最小白版本</Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight md:text-4xl">先不要做完整系统，先跑通 1 个产品</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                你现在不需要整理一堆文件，也不需要一次做 10 张图。先用一张产品图，让 AI 帮你生成可用的主图、详情图方向和英文资料。跑通以后再批量。
              </p>
            </div>
            <div className="rounded-3xl border bg-secondary/60 p-5">
              <p className="text-sm font-semibold">最简单一句话</p>
              <p className="mt-2 text-lg font-semibold leading-8">
                选 1 张清楚原图 → 复制万能提示词 → 发给 ChatGPT → 挑能用的图 → 检查后上传 Alibaba。
              </p>
            </div>
            <Button size="lg" onClick={() => void copyPrompt()}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "已复制万能提示词" : "复制万能提示词"}
            </Button>
          </div>

          <div className="rounded-3xl border bg-slate-950 p-5 text-slate-100">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-300" />
              <p className="text-sm font-semibold">你第一次只做这些就够了</p>
            </div>
            <div className="grid gap-3">
              {minimumOutputs.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm transition-colors",
                    doneItems.includes(item) ? "border-cyan-300/50 bg-cyan-300/10" : "hover:bg-white/10",
                  )}
                  onClick={() => toggleDone(item)}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                      doneItems.includes(item) ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/25",
                    )}
                  >
                    {doneItems.includes(item) ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  </span>
                  {item}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        {quickSteps.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <step.icon className="h-5 w-5" />
              </div>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{step.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>万能提示词</CardTitle>
          <CardDescription>复制后打开 ChatGPT，把产品图一起上传。它会先帮你拆成主图、细节图、场景图、多角度图和英文资料。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border bg-slate-950 p-4">
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-100">{simplePrompt}</pre>
          </div>
          <Button className="w-full" onClick={() => void copyPrompt()}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? "已复制" : "复制这条提示词"}
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>不要一开始做太多</CardTitle>
            <CardDescription>这些可以等你跑通 3 个产品以后再加。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {advancedOutputs.map((item) => (
              <div key={item} className="rounded-2xl border bg-white/70 px-4 py-3 text-sm text-muted-foreground">
                以后再做：{item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>每天实际怎么做</CardTitle>
            <CardDescription>适合你现在马上开始的人工半自动版本。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              <strong className="text-foreground">上午：</strong>挑 1 个 SKU，找 1 张最清楚的原图，复制万能提示词给 ChatGPT。
            </p>
            <p>
              <strong className="text-foreground">下午：</strong>从 AI 结果里挑最像实物的图，不像实物的直接删，不要修太久。
            </p>
            <p>
              <strong className="text-foreground">上传前：</strong>只确认主图白底无字、产品结构没变、英文参数没乱写。通过就上传。
            </p>
            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-foreground">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Send className="h-4 w-4 text-primary" />
                第一周目标
              </div>
              不追求完美。只跑通 3 个产品，每个产品先做 5 个最小交付文件。
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
