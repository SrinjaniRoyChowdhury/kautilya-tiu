import type { Metadata } from "next";
import Link from "next/link";
import { HiOutlineCheckCircle, HiArrowRight } from "react-icons/hi";
import { Container, Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Email Confirmed | Kautilya",
  description: "Your email address has been successfully verified.",
};

export default function EmailConfirmedPage() {
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      <div className="mx-auto w-full max-w-md text-center">
        {/* Animated check icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold-400/40 bg-gold-700/10">
          <HiOutlineCheckCircle className="h-10 w-10 text-gold-700" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">
          Verification complete
        </p>

        <h1 className="mt-3 font-serif text-3xl font-bold text-ink sm:text-4xl">
          Email Confirmed
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          Your email address has been successfully verified. You can now sign in
          to your Kautilya account and access your dashboard.
        </p>

        <Card className="mt-8 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">
            Next step
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Head to the sign-in page and log in with your registered email and
            password to access the delegate portal.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-2 rounded-sm bg-gold-700 px-5 py-2.5 text-sm font-semibold text-parchment-50 transition hover:bg-gold-700/90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-700"
          >
            Sign in now <HiArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <p className="mt-6 text-xs text-ink-muted">
          Didn&apos;t mean to verify?{" "}
          <Link href="/" className="text-gold-700 hover:underline">
            Return home
          </Link>
        </p>
      </div>
    </Container>
  );
}
