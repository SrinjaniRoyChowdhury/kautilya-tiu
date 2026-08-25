"use client";

import { useEffect, useState } from "react";
import { formatInrFromMinor } from "@/lib/format";

export type PayableDelegate = {
  email: string;
  full_name: string;
  committee: string | null;
  fee_minor: number;
  registration_id: string;
};

export function DelegateEmailPicker({
  editionId,
  name = "emails",
  inputId,
  excludeEmails,
  single = false,
  label = "Pay for registered delegates",
  hint = "Search by name or email. Only people who have submitted a registration (so the fee is known) can be added. Unregistered emails cannot be paid for.",
}: {
  editionId: string;
  name?: string;
  inputId?: string;
  excludeEmails?: string[];
  single?: boolean;
  label?: string;
  hint?: string;
}) {
  const searchId = inputId ?? `${name}-search`;
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PayableDelegate[]>([]);
  const [selected, setSelected] = useState<PayableDelegate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const excludeKey = (excludeEmails ?? []).map((email) => email.toLowerCase()).join("\0");
  const q = query.trim();
  const shownHits = q.length < 1 ? [] : hits;

  useEffect(() => {
    if (q.length < 1) return;
    const blocked = new Set([
      ...excludeKey.split("\0").filter(Boolean),
      ...selected.map((row) => row.email.toLowerCase()),
    ]);
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pay/search?edition=${encodeURIComponent(editionId)}&q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        const json = (await res.json()) as { delegates?: PayableDelegate[] };
        setHits((json.delegates ?? []).filter((row) => !blocked.has(row.email.toLowerCase())));
        setOpen(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [q, editionId, excludeKey, selected]);

  function pick(row: PayableDelegate) {
    setSelected((prev) => {
      if (single) return [row];
      return prev.some((item) => item.email === row.email) ? prev : [...prev, row];
    });
    setQuery("");
    setHits([]);
    setOpen(false);
  }

  function remove(email: string) {
    setSelected((prev) => prev.filter((row) => row.email !== email));
  }

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={selected.map((row) => row.email).join("\n")} />
      <label className="text-sm font-medium text-ink" htmlFor={searchId}>
        {label}
      </label>
      <p className="text-xs text-ink-muted">{hint}</p>
      {selected.length ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((row) => (
            <li key={row.email}>
              <button
                type="button"
                className="rounded-sm border border-gold-700/30 bg-parchment-100 px-2 py-1 text-xs text-gold-700"
                onClick={() => remove(row.email)}
              >
                {row.full_name} · {row.email} ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative">
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => shownHits.length && setOpen(true)}
          placeholder="Start typing a name or email"
          className="w-full rounded-sm border border-gold-700/25 bg-parchment-50 px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60"
        />
        {open && (loading || shownHits.length > 0 || q) ? (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-sm border border-gold-700/25 bg-parchment-50 shadow-sm">
            {loading ? (
              <li className="px-3 py-2 text-sm text-ink-muted">Searching…</li>
            ) : shownHits.length ? (
              shownHits.map((row) => (
                <li key={row.registration_id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-parchment-200"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(row)}
                  >
                    <span className="font-medium">{row.full_name}</span>
                    <span className="text-xs text-ink-muted">
                      {row.email}
                      {row.committee ? ` · ${row.committee}` : ""} · {formatInrFromMinor(row.fee_minor)}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-ink-muted">
                No submitted registration matches. They must register first.
              </li>
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
