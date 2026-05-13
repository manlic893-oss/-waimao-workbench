export type AlibabaTitleOption = {
  title: string;
  characterCount: number;
  passed: boolean;
  issues: string[];
};

export type AlibabaTitleResult = {
  productIdentification: string;
  possibleMaterial: string;
  shapeOrStyle: string;
  recommendedKeywords: string[];
  keywordsToAvoid: string[];
  titles: AlibabaTitleOption[];
  recommendedTitle: string;
  reason: string;
  riskCheck: string[];
};

const TITLE_PATTERN = /^[A-Za-z0-9 ]+$/;
const BLOCKED_WORDS = ["best", "perfect", "no1", "cheapest"];

export function normalizeTitle(title: string) {
  return title.replace(/\s+/g, " ").trim();
}

export function validateAlibabaTitle(title: string, forbiddenWords: string[] = []) {
  const normalizedTitle = normalizeTitle(title);
  const lowerTitle = normalizedTitle.toLowerCase();
  const blockedWords = [...BLOCKED_WORDS, ...forbiddenWords.map((word) => word.trim().toLowerCase()).filter(Boolean)];
  const issues: string[] = [];

  if (!normalizedTitle) {
    issues.push("标题为空");
  }

  if (normalizedTitle.length > 128) {
    issues.push("标题超过 128 个英文字符");
  }

  if (!TITLE_PATTERN.test(normalizedTitle)) {
    issues.push("标题只能包含英文字母 数字 和空格");
  }

  for (const word of blockedWords) {
    if (!word) continue;
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escapedWord}\\b`, "i").test(lowerTitle)) {
      issues.push(`包含禁止词 ${word}`);
    }
  }

  return {
    title: normalizedTitle,
    characterCount: normalizedTitle.length,
    passed: issues.length === 0,
    issues,
  };
}

export function validateAlibabaTitleResult(result: AlibabaTitleResult, forbiddenWords: string[] = []) {
  const titles = result.titles.map((item) => ({
    ...item,
    ...validateAlibabaTitle(item.title, forbiddenWords),
  }));
  const recommendedTitleCheck = validateAlibabaTitle(result.recommendedTitle, forbiddenWords);

  const titleMatches = titles.some((item) => item.title === recommendedTitleCheck.title);
  const passed = titles.length === 3 && titles.every((item) => item.passed) && recommendedTitleCheck.passed && titleMatches;
  const issues: string[] = [];

  if (titles.length !== 3) {
    issues.push("必须生成 3 个标题候选");
  }

  if (!titleMatches) {
    issues.push("推荐标题必须来自 3 个标题候选之一");
  }

  for (const [index, title] of titles.entries()) {
    if (!title.passed) {
      issues.push(`标题 ${index + 1} 不合规 ${title.issues.join(" ")}`);
    }
  }

  if (!recommendedTitleCheck.passed) {
    issues.push(`推荐标题不合规 ${recommendedTitleCheck.issues.join(" ")}`);
  }

  return {
    result: {
      ...result,
      titles,
      recommendedTitle: recommendedTitleCheck.title,
    },
    passed,
    issues,
  };
}
