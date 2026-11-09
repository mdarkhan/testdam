import { z } from "zod";
import type { FormState } from "@/components/admin/form";
import { slugify } from "./normalize";

/** Validates FormData with a zod schema; on failure returns a FormState with per-field errors. */
export function parseForm<T extends z.ZodType>(schema: T, data: FormData): { data: z.infer<T> } | { error: FormState } {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of data.entries()) {
    if (k.startsWith("$")) continue; // React internal fields
    raw[k] = k in raw ? ([] as unknown[]).concat(raw[k], v) : v;
  }
  const r = schema.safeParse(raw);
  if (r.success) return { data: r.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return { error: { message: "Please fix the highlighted fields.", fieldErrors } };
}

export const zText = (label: string, max = 200) => z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);
export const zOptText = (max = 500) => z.string().trim().max(max).optional().transform((v) => v || null);
export const zSlug = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? slugify(v) : ""))
  .refine((v) => v === "" || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), "Use lower-case letters, digits and hyphens");
export const zCheckbox = z.any().optional().transform((v) => v === "on" || v === "true"); // unchecked boxes send nothing
export const zOptInt = (label: string) =>
  z.string().trim().optional().transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: `${label} must be a whole number` });
      return z.NEVER;
    }
    return n;
  });

/** Prisma unique-constraint error → friendly field error. */
export function uniqueError(e: unknown, field: string, message: string): FormState | null {
  return (e as { code?: string })?.code === "P2002" ? { message: "Please fix the highlighted fields.", fieldErrors: { [field]: message } } : null;
}
