import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(1, "请输入任务标题"),
  category: z.enum(["inquiry", "rfq", "product", "other", "relationship"]),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

export const statsSchema = z.object({
  inquiry_count: z.number().min(0, "不能小于 0"),
  rfq_sent: z.number().min(0, "不能小于 0"),
  new_products: z.number().min(0, "不能小于 0"),
  orders_closed: z.number().min(0, "不能小于 0"),
  notes: z.string().optional(),
});

export type StatsFormValues = z.infer<typeof statsSchema>;
