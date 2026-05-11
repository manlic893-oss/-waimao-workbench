import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1, "请输入客户名"),
  country: z.string().optional(),
  source: z.string().optional(),
  grade: z.string().optional(),
  status: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("请输入正确的邮箱地址").or(z.literal("")).optional(),
  product: z.string().optional(),
  next_follow_date: z.string().optional(),
  notes: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

export const customerLogSchema = z.object({
  content: z.string().min(1, "请输入沟通内容").max(1000, "内容请控制在 1000 字以内"),
});

export type CustomerLogValues = z.infer<typeof customerLogSchema>;
