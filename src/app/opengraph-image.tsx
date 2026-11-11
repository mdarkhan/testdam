// Default share image for every page without its own (home, /tests, /labs, /basket, /corporate…).
import { OG_SIZE, ogCard } from "@/lib/og";

export const alt = "Test Mate: compare diagnostic test prices across labs in Dhaka";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    title: "Same test. Different price at every lab.",
    subtitle: "Compare diagnostic test prices in Dhaka",
    decorative: true,
    note: "Every price shows the date it was checked.",
  });
}
