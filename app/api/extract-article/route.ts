import { load } from "cheerio";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url?: string };

  if (!url) {
    return NextResponse.json({ error: "缺少链接" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 Codex Knowledge Extractor",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "抓取失败" }, { status: 400 });
    }

    const html = await response.text();
    const $ = load(html);

    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      $("h1").first().text().trim();
    const summary =
      $("meta[name='description']").attr("content") ||
      $("meta[property='og:description']").attr("content") ||
      $("p")
        .slice(0, 3)
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean)
        .join("\n")
        .slice(0, 300);

    return NextResponse.json({
      title: title || "未抓取到标题",
      summary: summary || "",
    });
  } catch {
    return NextResponse.json({ error: "抓取失败，请检查链接是否可访问" }, { status: 500 });
  }
}
