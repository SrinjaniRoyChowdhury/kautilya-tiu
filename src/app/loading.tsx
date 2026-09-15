export default function PublicLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-12 sm:px-6" aria-busy="true" aria-live="polite">
      <div className="h-4 w-28 rounded-sm bg-parchment-300/80" />
      <div className="mt-3 h-10 w-full max-w-lg rounded-sm bg-parchment-200/90" />
      <div className="mt-3 h-4 w-3/4 max-w-xl rounded-sm bg-parchment-200/70" />
      <div className="mt-10 space-y-3">
        <div className="h-28 rounded-sm bg-parchment-200/70" />
        <div className="h-28 rounded-sm bg-parchment-200/60" />
        <div className="h-28 rounded-sm bg-parchment-200/50" />
      </div>
    </div>
  );
}
