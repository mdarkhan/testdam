// Shared class names (plain module so both server and client components can call it).
export function btn(variant: "primary" | "danger" | "plain" = "primary") {
  const base = "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
  if (variant === "danger") return `${base} border border-danger text-danger hover:bg-danger-soft`;
  if (variant === "plain") return `${base} border border-slate-300 bg-white hover:bg-slate-50`;
  return `${base} bg-primary text-white hover:bg-primary-hover`;
}

export const tableCls = "w-full border-collapse text-sm [&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border-b [&_td]:border-line [&_td]:px-2 [&_td]:py-2";
