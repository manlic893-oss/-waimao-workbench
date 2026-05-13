import { NextResponse } from "next/server";
import { validateAlibabaTitleResult, type AlibabaTitleResult } from "@/lib/alibaba-title";
import { getAIProvider, getDeepSeekApiKey, getOpenAIApiKey } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";
const TITLE_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    productIdentification: { type: "string" },
    possibleMaterial: { type: "string" },
    shapeOrStyle: { type: "string" },
    recommendedKeywords: { type: "array", items: { type: "string" } },
    keywordsToAvoid: { type: "array", items: { type: "string" } },
    titles: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          characterCount: { type: "number" },
          passed: { type: "boolean" },
          issues: { type: "array", items: { type: "string" } },
        },
        required: ["title", "characterCount", "passed", "issues"],
      },
    },
    recommendedTitle: { type: "string" },
    reason: { type: "string" },
    riskCheck: { type: "array", items: { type: "string" } },
  },
  required: [
    "productIdentification",
    "possibleMaterial",
    "shapeOrStyle",
    "recommendedKeywords",
    "keywordsToAvoid",
    "titles",
    "recommendedTitle",
    "reason",
    "riskCheck",
  ],
};

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseForbiddenWords(value: string) {
  return value
    .split(/[\n,，;；]+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function safeFileName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "jpg";
  const normalizedExtension = ["png", "jpg", "jpeg", "webp"].includes(extension) ? extension : "jpg";
  return `${crypto.randomUUID()}.${normalizedExtension}`;
}

function buildPrompt(input: {
  sku: string;
  confirmedMaterial: string;
  confirmedSize: string;
  confirmedUsage: string;
  referenceText: string;
  forbiddenWords: string;
  previousIssues?: string[];
}) {
  const retryBlock = input.previousIssues?.length
    ? `\nPrevious output failed validation. Fix these issues exactly:\n${input.previousIssues.join("\n")}\n`
    : "";
  const productEvidence = [
    input.confirmedMaterial,
    input.confirmedSize,
    input.confirmedUsage,
    input.referenceText,
  ].some(Boolean)
    ? "Use the confirmed product info and reference text as product evidence"
    : "Use the image as the only product evidence";

  return `You are an Alibaba com B2B SEO specialist for crystal lighting accessories

Analyze the product image and generate Alibaba product title options

Hard title rules
Each title must be 128 English characters or fewer
Each title must use English words numbers and spaces only
Do not use any punctuation marks or symbols
Do not use commas slashes hyphens brackets colons quotation marks pipes periods ampersands plus signs or symbols
Do not use exaggerated words such as best perfect No1 cheapest
Do not copy competitor titles directly
Do not invent unconfirmed material size or grade
If K9 crystal glass acrylic or size cannot be confirmed mark it as needs confirmation in riskCheck only
The recommendedTitle must be exactly one of the 3 titles

Business context
Platform Alibaba international B2B
Product range crystal lighting accessories chandelier parts crystal pendants beads chains garlands and decorative lighting parts
Optimization priority search keywords
${productEvidence}

Optional confirmed product info
SKU ${input.sku || "not provided"}
Confirmed material ${input.confirmedMaterial || "not provided"}
Confirmed size ${input.confirmedSize || "not provided"}
Confirmed usage ${input.confirmedUsage || "not provided"}
Reference keywords or competitor title text ${input.referenceText || "not provided"}
Forbidden words ${input.forbiddenWords || "none"}
${retryBlock}
Return only JSON matching the schema`;
}

function buildDeepSeekPrompt(input: {
  sku: string;
  confirmedMaterial: string;
  confirmedSize: string;
  confirmedUsage: string;
  referenceText: string;
  forbiddenWords: string;
  previousIssues?: string[];
}) {
  const retryBlock = input.previousIssues?.length
    ? `\nPrevious output failed validation. Fix these issues exactly:\n${input.previousIssues.join("\n")}\n`
    : "";

  return `You are an Alibaba com B2B SEO specialist for crystal lighting accessories

Generate Alibaba product title options from the text evidence below
Important limitation
You cannot see the uploaded image in DeepSeek mode
Use only the confirmed product info reference keywords product description or competitor title text below
If product type material shape or usage is not provided mark it as needs confirmation in riskCheck

Hard title rules
Each title must be 128 English characters or fewer
Each title must use English words numbers and spaces only
Do not use any punctuation marks or symbols
Do not use commas slashes hyphens brackets colons quotation marks pipes periods ampersands plus signs or symbols
Do not use exaggerated words such as best perfect No1 cheapest
Do not copy competitor titles directly
Do not invent unconfirmed material size or grade
The recommendedTitle must be exactly one of the 3 titles

Business context
Platform Alibaba international B2B
Product range crystal lighting accessories chandelier parts crystal pendants beads chains garlands and decorative lighting parts
Optimization priority search keywords

Text evidence
SKU ${input.sku || "not provided"}
Confirmed material ${input.confirmedMaterial || "not provided"}
Confirmed size ${input.confirmedSize || "not provided"}
Confirmed usage ${input.confirmedUsage || "not provided"}
Reference keywords product description or competitor title text ${input.referenceText || "not provided"}
Forbidden words ${input.forbiddenWords || "none"}
${retryBlock}
Return valid JSON only with this shape
{
  "productIdentification": "",
  "possibleMaterial": "",
  "shapeOrStyle": "",
  "recommendedKeywords": [],
  "keywordsToAvoid": [],
  "titles": [
    { "title": "", "characterCount": 0, "passed": true, "issues": [] },
    { "title": "", "characterCount": 0, "passed": true, "issues": [] },
    { "title": "", "characterCount": 0, "passed": true, "issues": [] }
  ],
  "recommendedTitle": "",
  "reason": "",
  "riskCheck": []
}`;
}

function extractOpenAIText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as { output_text?: unknown; output?: Array<{ content?: Array<Record<string, unknown>> }> };

  if (typeof response.output_text === "string") return response.output_text;

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") chunks.push(content.text);
      if (typeof content.output_text === "string") chunks.push(content.output_text);
    }
  }

  return chunks.join("\n").trim();
}

function parseTitleResult(text: string): AlibabaTitleResult {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("AI 返回内容不是 JSON");
  }

  return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as AlibabaTitleResult;
}

function extractDeepSeekText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = response.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

async function callOpenAI({
  apiKey,
  imageDataUrl,
  prompt,
}: {
  apiKey: string;
  imageDataUrl: string;
  prompt: string;
}) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "alibaba_title_generation",
          schema: TITLE_RESULT_SCHEMA,
          strict: true,
        },
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      typeof payload?.error?.message === "string" ? payload.error.message : "OpenAI 标题生成失败";
    throw new Error(message);
  }

  return parseTitleResult(extractOpenAIText(payload));
}

async function callDeepSeek({
  apiKey,
  prompt,
}: {
  apiKey: string;
  prompt: string;
}) {
  const response = await fetch(DEEPSEEK_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content: "You return valid JSON only. Never include markdown fences or explanations outside JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      typeof payload?.error?.message === "string" ? payload.error.message : "DeepSeek 标题生成失败";
    throw new Error(message);
  }

  return parseTitleResult(extractDeepSeekText(payload));
}

export async function POST(request: Request) {
  const provider = getAIProvider();
  const apiKey = provider === "deepseek" ? getDeepSeekApiKey() : getOpenAIApiKey();

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          provider === "deepseek"
            ? "缺少 DEEPSEEK_API_KEY，请先配置环境变量。"
            : "缺少 OPENAI_API_KEY，请先配置环境变量。",
      },
      { status: 500 },
    );
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录后再生成标题。" }, { status: 401 });
  }

  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "请上传产品图片。" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return NextResponse.json({ error: "图片格式仅支持 PNG JPG JPEG 或 WEBP。" }, { status: 400 });
  }

  if (image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "图片不能超过 8MB。" }, { status: 400 });
  }

  const sku = formValue(formData, "sku");
  const confirmedMaterial = formValue(formData, "confirmedMaterial");
  const confirmedSize = formValue(formData, "confirmedSize");
  const confirmedUsage = formValue(formData, "confirmedUsage");
  const referenceText = formValue(formData, "referenceText");
  const forbiddenWords = formValue(formData, "forbiddenWords");
  const forbiddenWordList = parseForbiddenWords(forbiddenWords);
  const hasTextEvidence = Boolean(confirmedMaterial || confirmedSize || confirmedUsage || referenceText);

  if (provider === "deepseek" && !hasTextEvidence) {
    return NextResponse.json(
      {
        error: "DeepSeek 模式暂不支持直接识别图片，请至少填写材质 尺寸 用途 参考关键词 产品描述或同行标题之一。",
      },
      { status: 400 },
    );
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const imagePath = `${user.id}/${safeFileName(image.name)}`;
  const imageDataUrl = `data:${image.type};base64,${imageBuffer.toString("base64")}`;

  const uploadResult = await supabase.storage
    .from("product-title-images")
    .upload(imagePath, imageBuffer, {
      contentType: image.type,
      upsert: false,
    });

  if (uploadResult.error) {
    return NextResponse.json({ error: `图片上传失败：${uploadResult.error.message}` }, { status: 500 });
  }

  let previousIssues: string[] = [];
  let validatedResult: ReturnType<typeof validateAlibabaTitleResult> | null = null;

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const promptInput = {
        sku,
        confirmedMaterial,
        confirmedSize,
        confirmedUsage,
        referenceText,
        forbiddenWords,
        previousIssues,
      };
      const result =
        provider === "deepseek"
          ? await callDeepSeek({
              apiKey,
              prompt: buildDeepSeekPrompt(promptInput),
            })
          : await callOpenAI({
              apiKey,
              imageDataUrl,
              prompt: buildPrompt(promptInput),
            });

      validatedResult = validateAlibabaTitleResult(result, forbiddenWordList);

      if (validatedResult.passed) {
        break;
      }

      previousIssues = validatedResult.issues;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI 标题生成失败";
    const isQuotaError = message.toLowerCase().includes("quota");

    return NextResponse.json(
      {
        error: isQuotaError
          ? `${provider === "deepseek" ? "DeepSeek" : "OpenAI"} API 当前额度不足或账单未开通，请检查账户的 Billing 和 Usage。`
          : `${provider === "deepseek" ? "DeepSeek" : "OpenAI"} 标题生成失败：${message}`,
      },
      { status: isQuotaError ? 402 : 500 },
    );
  }

  if (!validatedResult?.passed) {
    return NextResponse.json(
      {
        error: "AI 已返回结果，但标题未通过规则检查，未保存为推荐标题。",
        issues: validatedResult?.issues ?? ["未知校验错误"],
      },
      { status: 422 },
    );
  }

  const insertPayload = {
    user_id: user.id,
    image_path: imagePath,
    sku: sku || null,
    confirmed_material: confirmedMaterial || null,
    confirmed_size: confirmedSize || null,
    confirmed_usage: confirmedUsage || null,
    reference_text: referenceText || null,
    forbidden_words: forbiddenWordList,
    product_identification: validatedResult.result.productIdentification,
    possible_material: validatedResult.result.possibleMaterial,
    shape_or_style: validatedResult.result.shapeOrStyle,
    recommended_keywords: validatedResult.result.recommendedKeywords,
    keywords_to_avoid: validatedResult.result.keywordsToAvoid,
    titles: validatedResult.result.titles,
    recommended_title: validatedResult.result.recommendedTitle,
    reason: validatedResult.result.reason,
    risk_check: validatedResult.result.riskCheck,
    confirmed_title: null,
    status: "generated",
    created_by: user.id,
    updated_by: user.id,
  };

  const { data, error } = await supabase.from("alibaba_title_generations").insert(insertPayload).select("*").single();

  if (error) {
    return NextResponse.json({ error: `标题记录保存失败：${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ record: data });
}
