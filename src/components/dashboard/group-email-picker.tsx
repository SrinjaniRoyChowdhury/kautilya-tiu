"use client";

import { useEffect, useState } from "react";

export type GroupDelegate = {
  registration_id: string;
  email: string;
  full_name: string;
  committee: string | null;
  status: string;
};

export function GroupEmailPicker({
  editionId,
  collectiveId,
  institutionId,
  onPick,
  label = "Add member by email",
  hint = "Search registered delegates by name or email.",
}: {
  editionId: string;
  collectiveId?: string | null;
  institutionId?: string | null;
  onPick: (delegate: GroupDelegate) => void;
  label?: string;
  hint?: string;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GroupDelegate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const q = query.trim();
  const shownHits = q.length < 1 ? [] : hits;

  useEffect(() => {
    if (q.length < 1) return;
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ edition: editionId, q });
        if (collectiveId) params.set("collective", collectiveId);
        if (institutionId) params.set("institution", institutionId);
        const res = await fetch(`/api/team/search?${params}`, { signal: controller.signal });
        const json = (await res.json()) as { delegates?: GroupDelegate[] };
        setHits(json.delegates ?? []);
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
  }, [q, editionId, collectiveId, institutionId]);

  function pick(row: GroupDelegate) {
    onPick(row);
    setQuery("");
    setHits([]);
    setOpen(false);
  }

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-ink" htmlFor="group-member-search">
        {label}
      </label>
      <p className="text-xs text-ink-muted">{hint}</p>
      <div className="relative">
        <input
          id="group-member-search"
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
                      {row.committee ? ` · ${row.committee}` : ""} · {row.status}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-ink-muted">No matching registration.</li>
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export type RepCandidate = {
  user_id: string;
  registration_id: string;
  full_name: string;
  email: string;
  status: string;
};

export function RepEmailPicker({
  editionId,
  onPick,
}: {
  editionId: string;
  onPick: (candidate: RepCandidate) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<RepCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const q = query.trim();
  const shownHits = q.length < 1 ? [] : hits;

  useEffect(() => {
    if (q.length < 1) return;
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ edition: editionId, q });
        const res = await fetch(`/api/team/search-rep?${params}`, { signal: controller.signal });
        const json = (await res.json()) as { candidates?: RepCandidate[] };
        setHits(json.candidates ?? []);
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
  }, [q, editionId]);

  function pick(row: RepCandidate) {
    onPick(row);
    setQuery("");
    setHits([]);
    setOpen(false);
  }

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-ink" htmlFor="rep-search">
        Representative
      </label>
      <p className="text-xs text-ink-muted">
        Assign a registered, unpaid delegate. They will get a My team section on their dashboard.
      </p>
      <div className="relative">
        <input
          id="rep-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email"
          className="w-full rounded-sm border border-gold-700/25 bg-parchment-50 px-3 py-2.5 text-sm text-ink"
        />
        {open && (loading || shownHits.length > 0 || q) ? (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-sm border border-gold-700/25 bg-parchment-50 shadow-sm">
            {loading ? (
              <li className="px-3 py-2 text-sm text-ink-muted">Searching…</li>
            ) : shownHits.length ? (
              shownHits.map((row) => (
                <li key={row.user_id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-parchment-200"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(row)}
                  >
                    <span className="font-medium">{row.full_name}</span>
                    <span className="text-xs text-ink-muted">
                      {row.email} · {row.status}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-ink-muted">No eligible unpaid registration.</li>
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
