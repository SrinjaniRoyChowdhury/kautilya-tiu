import type { Metadata } from "next";
import { GallerySection } from "@/components/public/gallery-section";

export const metadata: Metadata = {
  title: "Gallery | Niti Sabha 2025 Highlights",
  description: "Conference highlights from Niti Sabha 2025 — glimpses of debate, diplomacy, and statecraft.",
};

export default function GalleryPage() {
  return (
    <main className="min-h-[70vh]">
      <GallerySection />
    </main>
  );
}
