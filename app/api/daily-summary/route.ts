import { NextResponse } from "next/server";
import { getAnthropicApiKey } from "@/lib/env";

type SummaryPayload = {
  inquiry_count: number;
  rfq_sent: number;
  new_products: number;
  orders_closed: number;
  notes?: string;
};

function buildFallbackSummary(payload: SummaryPayload) {
  const parts = [
    `今天共处理询盘 ${payload.inquiry_count} 条，发送 RFQ 报价 ${payload.rfq_sent} 条。`,
    `新发品 ${payload.new_products} 个，成交订单 ${payload.orders_closed} 单。`,
  ];

  if (payload.notes?.trim()) {
    parts.push(`今天的补充记录是：${payload.notes.trim()}`);
  }

  const cheer =
    payload.orders_closed > 0
      ? "🎉 今天已经把结果落到订单上了，继续把节奏保持住。"
      : payload.new_products >= 5
        ? "💪 发品和积累都在往前走，今天做的铺垫会慢慢变成后面的询盘。"
        : "🌱 外贸就是持续播种，今天记下来的每一步都在帮明天省力。";

  return {
    summary: parts.join(" "),
    encouragement: cheer,
  };
}

export async function POST(request: Request) {
  const payload = (await request.json()) as SummaryPayload;
  const apiKey = getAnthropicApiKey();

  if (!apiKey) {
    return NextResponse.json(buildFallbackSummary(payload));
  }

  const prompt = `
你是一个外贸团队的工作助手，请根据以下今日工作数据，生成一段简短的工作总结（2-3句话）和一句轻松有趣的激励语。

今日数据：
- 询盘数：${payload.inquiry_count} 条
- RFQ报价：${payload.rfq_sent} 条
- 新发品：${payload.new_products} 个
- 成交订单：${payload.orders_closed} 单
- 今日备注：${payload.notes ?? "无"}

要求：
1. 总结要结合数据，指出做得好的地方或需要关注的点
2. 激励语要轻松、真诚、有点趣味，不要太鸡汤
3. 用中文回复
4. 只返回 JSON，格式为 {"summary":"...","encouragement":"..."}
`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(buildFallbackSummary(payload));
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content?.find((item) => item.type === "text")?.text ?? "";
    const parsed = JSON.parse(text) as { summary: string; encouragement: string };
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(buildFallbackSummary(payload));
  }
}
