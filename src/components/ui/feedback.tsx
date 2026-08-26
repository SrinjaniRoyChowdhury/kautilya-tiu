import { cn } from "@/lib/format";

export function ActionFeedback({
  error,
  success,
  warning,
  className,
}: {
  error?: string;
  success?: string;
  warning?: string;
  className?: string;
}) {
  const message = error ?? success ?? warning;
  if (!message) return null;
  return (
    <p
      className={cn(
        "mt-2 rounded-sm px-3 py-2 text-sm",
        error ? "bg-red-50 text-red-800" : "bg-parchment-200 text-ink",
        className,
      )}
      role={error ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
