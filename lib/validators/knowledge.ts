import { z } from "zod";

export const productKnowledgeSchema = z.object({
  product_name: z.string().min(1, "请输入产品名称"),
  category: z.string().optional(),
  specs: z.string().optional(),
  price_range: z.string().optional(),
  moq: z.string().optional(),
  material: z.string().optional(),
  lead_time: z.string().optional(),
  notes: z.string().optional(),
});

export type ProductKnowledgeFormValues = z.infer<typeof productKnowledgeSchema>;

export const knowledgeArticleSchema = z.object({
  title: z.string().min(1, "请输入标题"),
  url: z.string().url("请输入正确链接").or(z.literal("")).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  tags: z.string().optional(),
  category: z.enum(["sales_skills", "trade_knowledge", "tools", "other"]),
});

export type KnowledgeArticleFormValues = z.infer<typeof knowledgeArticleSchema>;
