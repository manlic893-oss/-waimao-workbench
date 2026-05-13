import { z } from "zod";

export const alibabaTitleInputSchema = z.object({
  sku: z.string().optional(),
  confirmedMaterial: z.string().optional(),
  confirmedSize: z.string().optional(),
  confirmedUsage: z.string().optional(),
  referenceText: z.string().optional(),
  forbiddenWords: z.string().optional(),
});

export type AlibabaTitleInputValues = z.infer<typeof alibabaTitleInputSchema>;
