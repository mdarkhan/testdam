import { OG_SIZE } from "@/lib/og";
import { testShareImage } from "@/lib/og-pages";

export const alt = "Test price range across labs in this area of Dhaka";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string; area: string }> }) {
  const { slug, area } = await params;
  return testShareImage(slug, area);
}
