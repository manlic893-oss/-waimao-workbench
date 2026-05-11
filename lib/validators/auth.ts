import { z } from "zod";

export const authSchema = z.object({
  email: z.string().email("请输入正确的邮箱地址"),
  password: z.string().min(6, "密码至少 6 位"),
});

export type AuthValues = z.infer<typeof authSchema>;
