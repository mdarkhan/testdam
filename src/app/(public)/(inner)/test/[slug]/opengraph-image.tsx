import { OG_SIZE } from "@/lib/og";
import { testShareImage } from "@/lib/og-pages";

export const alt = "Test price range across labs in Dhaka";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 86400; // like the page: prices go stale by day

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return testShareImage((await params).slug);
}
