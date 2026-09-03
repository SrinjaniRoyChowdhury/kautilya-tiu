"use client";

import { useState } from "react";
import Image from "next/image";
import { HiOutlinePhotograph, HiOutlineX, HiOutlineChevronLeft, HiOutlineChevronRight } from "react-icons/hi";
import { Container } from "@/components/ui/card";
import { MotionReveal } from "@/components/motion/reveal";
import { HARDCODED_GALLERY_IMAGES, type HardcodedGalleryImage } from "@/lib/gallery-data";

export function GallerySection() {
  const [activeImage, setActiveImage] = useState<HardcodedGalleryImage | null>(null);

  const handlePrev = () => {
    if (!activeImage) return;
    const currentIndex = HARDCODED_GALLERY_IMAGES.findIndex((img) => img.id === activeImage.id);
    const prevIndex = (currentIndex - 1 + HARDCODED_GALLERY_IMAGES.length) % HARDCODED_GALLERY_IMAGES.length;
    setActiveImage(HARDCODED_GALLERY_IMAGES[prevIndex]);
  };

  const handleNext = () => {
    if (!activeImage) return;
    const currentIndex = HARDCODED_GALLERY_IMAGES.findIndex((img) => img.id === activeImage.id);
    const nextIndex = (currentIndex + 1) % HARDCODED_GALLERY_IMAGES.length;
    setActiveImage(HARDCODED_GALLERY_IMAGES[nextIndex]);
  };

  return (
    <section id="gallery" className="relative py-12 sm:py-16">
      <style>{`
        @keyframes niti-gallery-rtl {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .niti-gallery-track {
          display: flex !important;
          width: max-content !important;
          animation: niti-gallery-rtl 25s linear infinite !important;
          will-change: transform;
        }
      `}</style>

      <Container>
        <MotionReveal className="mx-auto max-w-3xl text-center" delay={0.05}>
          <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">
            <HiOutlinePhotograph className="h-4 w-4" /> Conference Highlights
          </p>
          <h1 className="mt-3 font-serif text-3xl text-gold-gradient sm:text-5xl">Niti Sabha 2025</h1>
          <p className="mt-3 text-sm text-ink-muted sm:text-base">
            Glimpses of debate, diplomacy, statecraft, and committee moments from Niti Sabha 2025.
          </p>
        </MotionReveal>
      </Container>

      {/* Marquee Carousel moving right to left */}
      <div className="relative mt-10 w-full overflow-hidden py-12">
        {/* Soft edge gradient fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-parchment-50 via-parchment-50/80 to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-parchment-50 via-parchment-50/80 to-transparent sm:w-28" />

        {/* Scrolling track: duplicated 2x for seamless continuous loop */}
        <div className="niti-gallery-track flex gap-6 px-4">
          {[...HARDCODED_GALLERY_IMAGES, ...HARDCODED_GALLERY_IMAGES].map((image, index) => (
            <div
              key={`${image.id}-${index}`}
              onClick={() => setActiveImage(image)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveImage(image);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Enlarge photo: ${image.title}`}
              className="group relative h-56 w-80 shrink-0 cursor-pointer overflow-hidden rounded-md border border-gold-700/35 bg-parchment-50 shadow-md transition-all duration-300 ease-out hover:z-30 hover:scale-120 hover:border-gold-400 hover:shadow-[0_20px_45px_rgba(140,104,40,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-700 sm:h-64 sm:w-96"
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={800}
                height={533}
                unoptimized
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />

              {/* Bottom gradient overlay with title and tag */}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent opacity-75 transition-opacity duration-300 group-hover:opacity-95" />

              <div className="absolute inset-x-0 bottom-0 p-4 transition-transform duration-300 ease-out">
                {image.tag ? (
                  <span className="inline-block rounded bg-gold-700/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-parchment-50 backdrop-blur-xs">
                    {image.tag}
                  </span>
                ) : null}
                <p className="mt-1 font-serif text-base font-semibold text-parchment-50 drop-shadow-sm sm:text-lg">
                  {image.title}
                </p>
                {image.caption ? (
                  <p className="mt-1 line-clamp-2 text-xs text-parchment-200/90 transition-opacity duration-300">
                    {image.caption}
                  </p>
                ) : null}
              </div>

              {/* Corner badge counter */}
              <div className="absolute top-2.5 right-2.5 rounded-full border border-gold-400/40 bg-ink/75 px-2 py-0.5 text-[10px] font-mono font-medium text-gold-400 backdrop-blur-xs">
                {String(image.id).padStart(2, "0")} / 10
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Lightbox Modal on Image Click */}
      {activeImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
          onClick={() => setActiveImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged view"
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-lg border border-gold-400/50 bg-parchment-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              className="absolute top-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-parchment-50 transition hover:bg-ink hover:text-gold-400"
              aria-label="Close modal"
            >
              <HiOutlineX className="h-5 w-5" />
            </button>

            {/* Prev / Next navigation */}
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink/70 text-parchment-50 transition hover:bg-ink hover:text-gold-400"
              aria-label="Previous photo"
            >
              <HiOutlineChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink/70 text-parchment-50 transition hover:bg-ink hover:text-gold-400"
              aria-label="Next photo"
            >
              <HiOutlineChevronRight className="h-6 w-6" />
            </button>

            <div className="relative aspect-[16/10] w-full max-h-[70vh] bg-black">
              <Image
                src={activeImage.src}
                alt={activeImage.alt}
                width={1200}
                height={800}
                unoptimized
                className="h-full w-full object-contain"
              />
            </div>

            <div className="border-t border-gold-700/20 bg-parchment-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  {activeImage.tag ? (
                    <span className="inline-block rounded bg-gold-700/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-gold-700">
                      {activeImage.tag}
                    </span>
                  ) : null}
                  <h3 className="mt-1 font-serif text-xl font-bold text-ink sm:text-2xl">{activeImage.title}</h3>
                </div>
                <span className="font-mono text-xs text-ink-muted">
                  Photo {activeImage.id} of 10
                </span>
              </div>
              {activeImage.caption ? (
                <p className="mt-2 text-sm text-ink-muted">{activeImage.caption}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
