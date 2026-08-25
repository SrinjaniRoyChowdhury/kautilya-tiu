import { formatDateTime12h } from "@/lib/format";
import type { AuditLog } from "@/types";

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) {
    return <p className="text-sm text-ink-muted">{label}: nothing recorded</p>;
  }
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">{label}</p>
      <pre className="mt-1 overflow-x-auto rounded-sm bg-parchment-200 p-3 text-xs text-ink">{text}</pre>
    </div>
  );
}

export function AuditRow({ row, href }: { row: AuditLog; href?: string | null }) {
  return (
    <article className="frame-gold rounded-sm bg-parchment-50/85 p-6 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {href ? (
            <a href={href} className="font-mono text-sm text-gold-700 hover:underline">
              {row.action}
            </a>
          ) : (
            <p className="font-mono text-sm text-gold-700">{row.action}</p>
          )}
          <p className="mt-1 text-sm text-ink-muted">
            {row.entity}
            {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""}
          </p>
          <p className="mt-1 text-sm">
            {row.actor_name ?? "System"}
            {row.actor_email ? ` · ${row.actor_email}` : ""}
          </p>
          {href ? (
            <a href={href} className="mt-2 inline-block text-sm text-gold-700 hover:underline">
              Open payment
            </a>
          ) : null}
        </div>
        <p className="text-xs text-ink-muted">{formatDateTime12h(row.created_at)}</p>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer list-none text-xs text-gold-700 [&::-webkit-details-marker]:hidden">
          Open details
        </summary>
        <div className="mt-4 grid gap-4 border-t border-gold-700/15 pt-4">
          <p className="text-sm">
            <span className="font-medium">Who:</span> {row.actor_name ?? "System"}
            {row.actor_email ? ` (${row.actor_email})` : ""}
          </p>
          <p className="text-sm">
            <span className="font-medium">When:</span> {formatDateTime12h(row.created_at)}
          </p>
          <p className="text-sm">
            <span className="font-medium">Record:</span> {row.entity}
            {row.entity_id ? ` ${row.entity_id}` : ""}
          </p>
          <JsonBlock label="Before" value={row.old_value} />
          <JsonBlock label="After" value={row.new_value} />
        </div>
      </details>
    </article>
  );
}
