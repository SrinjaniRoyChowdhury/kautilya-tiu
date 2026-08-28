import { paymentQrSrc } from "@/lib/payments";

export function PaymentQrImage({
  editionId,
  imageKey,
  alt = "Payment QR",
  className = "h-56 w-56 max-w-full rounded-sm border border-gold-700/25 bg-parchment-50 object-contain p-2",
}: {
  editionId: string;
  imageKey?: string | null;
  alt?: string;
  className?: string;
}) {
  const src = paymentQrSrc(editionId, imageKey);
  if (!src) return null;
  return (
    // Streamed same-origin QR; not a remote next/image host.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}
