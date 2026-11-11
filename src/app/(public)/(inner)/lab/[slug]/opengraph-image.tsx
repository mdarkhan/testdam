import { OG_SIZE } from "@/lib/og";
import { labShareImage } from "@/lib/og-pages";

export const alt = "Diagnostic lab test prices in Dhaka";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return labShareImage((await params).slug);
}
