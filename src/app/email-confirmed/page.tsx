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
        {/* Verification Check Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold-400/40 bg-gold-700/10 shadow-sm">
          <HiOutlineCheckCircle className="h-10 w-10 text-gold-700" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">
          Verification Complete
        </p>

        <h1 className="mt-3 font-serif text-3xl font-bold text-ink sm:text-4xl">
          Email Confirmed
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          Your email address has been successfully verified.
        </p>

        <Card className="mt-8 border-gold-400/30 bg-parchment-50/50 p-6 text-left shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">
            Next Step
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-ink">
            Please navigate back to the login screen and sign in to access your account.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold-700 px-5 py-3 text-sm font-semibold text-parchment-50 transition hover:bg-gold-800 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-700"
          >
            Navigate to Login Screen <HiArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <p className="mt-6 text-xs text-ink-muted">
          <Link href="/" className="text-gold-700 hover:underline">
            Return to Home Page
          </Link>
        </p>
      </div>
    </Container>
  );
}

