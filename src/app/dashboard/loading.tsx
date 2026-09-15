export default function DashboardLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-4 w-24 rounded-sm bg-parchment-300/80" />
      <div className="mt-3 h-9 w-full max-w-sm rounded-sm bg-parchment-200/90" />
      <div className="mt-2 h-4 w-2/3 max-w-md rounded-sm bg-parchment-200/70" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-sm bg-parchment-200/70" />
        <div className="h-40 rounded-sm bg-parchment-200/70" />
      </div>
    </div>
  );
}
