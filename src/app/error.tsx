"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-serif text-3xl text-gold-700">Something went wrong</h1>
      <p className="mt-3 text-sm text-ink-muted">
        {error.message || "The page failed to load. If this is a fresh clone, start Supabase first."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center rounded-sm bg-gold-700 px-5 text-sm text-parchment-50"
      >
        Try again
      </button>
    </div>
  );
}
