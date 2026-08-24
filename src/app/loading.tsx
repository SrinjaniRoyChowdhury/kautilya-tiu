export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 animate-pulse rounded-sm bg-parchment-300/70" />
      <div className="mt-4 h-24 w-full animate-pulse rounded-sm bg-parchment-200/80" />
    </div>
  );
}
