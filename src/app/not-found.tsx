import Link from "next/link";
import { Container } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Container className="py-20 text-center">
      <p className="text-xs uppercase tracking-[0.28em] text-gold-700">404</p>
      <h1 className="mt-3 font-serif text-4xl text-gold-gradient">Page not found</h1>
      <p className="mt-3 text-ink-muted">The record may be unpublished, hidden, or never existed.</p>
      <Link href="/" className="mt-6 inline-block text-gold-700 hover:underline">
        Return home
      </Link>
    </Container>
  );
}
