export default function AdminLoading() {
  return (
    <div className="animate-pulse p-4 sm:p-6" aria-busy="true" aria-live="polite">
      <div className="h-5 w-36 rounded-sm bg-parchment-300/80" />
      <div className="mt-3 h-9 w-full max-w-md rounded-sm bg-parchment-200/90" />
      <div className="mt-4 space-y-2">
        <div className="h-8 rounded-sm bg-parchment-200/70" />
        <div className="h-8 rounded-sm bg-parchment-200/70" />
        <div className="h-8 rounded-sm bg-parchment-200/70" />
        <div className="h-8 rounded-sm bg-parchment-200/50" />
        <div className="h-8 rounded-sm bg-parchment-200/50" />
      </div>
    </div>
  );
}
