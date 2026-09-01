"use client";

import { useState, useTransition } from "react";
import { HiOutlineMail, HiOutlinePhone, HiOutlineCheckCircle, HiOutlineClock } from "react-icons/hi";
import { AdminTable } from "@/components/admin/admin-filters";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDateTime12h } from "@/lib/format";
import { updateHelpDeskQueryStatusAction } from "@/app/actions/contact";
import type { HelpDeskQuery, HelpDeskQueryStatus, HelpDeskQueryType } from "@/types";

function TypeBadge({ type }: { type: HelpDeskQueryType | string }) {
  let color = "border-gold-700/30 bg-parchment-200 text-gold-800";
  if (type === "Delegate Queries") {
    color = "border-blue-700/30 bg-blue-50 text-blue-800";
  } else if (type === "Partnership") {
    color = "border-amber-700/30 bg-amber-50 text-amber-800";
  } else if (type === "Press and Faculty") {
    color = "border-purple-700/30 bg-purple-50 text-purple-800";
  }

  return (
    <span className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${color}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: HelpDeskQueryStatus }) {
  if (status === "RESOLVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        <HiOutlineCheckCircle className="h-3.5 w-3.5" />
        Resolved
      </span>
    );
  }
  if (status === "ARCHIVED") {
    return (
      <span className="inline-block rounded-sm border border-ink/20 bg-parchment-200 px-2 py-0.5 text-xs font-semibold text-ink-muted">
        Archived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-amber-600/30 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
      <HiOutlineClock className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}

export function HelpDeskView({ queries }: { queries: HelpDeskQuery[] }) {
  const [selected, setSelected] = useState<HelpDeskQuery | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStatusChange = (status: HelpDeskQueryStatus) => {
    if (!selected) return;
    startTransition(async () => {
      const res = await updateHelpDeskQueryStatusAction(selected.id, status);
      if (res.success) {
        setSelected((prev) => (prev ? { ...prev, status } : null));
      }
    });
  };

  if (!queries.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-700/10 text-gold-700">
          <HiOutlineMail className="h-6 w-6" />
        </div>
        <p className="mt-3 font-serif text-lg text-ink">No queries found</p>
        <p className="mt-1 text-sm text-ink-muted">No queries match your search or filter criteria.</p>
      </div>
    );
  }

  return (
    <>
      <AdminTable columns={["When", "Type", "Name & Contact", "Subject", "Status", ""]}>
        {queries.map((row) => (
          <tr
            key={row.id}
            className="group cursor-pointer border-b border-gold-700/10 hover:bg-parchment-100 transition-colors"
            onClick={() => setSelected(row)}
          >
            <td className="whitespace-nowrap px-2 py-2 text-xs text-ink-muted">
              {formatDateTime12h(row.created_at)}
            </td>
            <td className="px-2 py-2">
              <TypeBadge type={row.type} />
            </td>
            <td className="px-2 py-2">
              <span className="font-heading text-sm font-semibold text-ink block">{row.name}</span>
              <span className="text-xs text-ink-muted block">{row.email}</span>
              <span className="text-xs font-mono text-ink-muted block">{row.phone}</span>
            </td>
            <td className="px-2 py-2">
              <span className="font-medium text-sm text-ink line-clamp-1">{row.subject}</span>
              <span className="text-xs text-ink-muted line-clamp-1">{row.description}</span>
            </td>
            <td className="px-2 py-2 whitespace-nowrap">
              <StatusBadge status={row.status} />
            </td>
            <td className="px-2 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelected(row)}
              >
                View
              </Button>
            </td>
          </tr>
        ))}
      </AdminTable>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Query Details"
        wide
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold-700/20 pb-4">
              <div className="flex items-center gap-2">
                <TypeBadge type={selected.type} />
                <StatusBadge status={selected.status} />
              </div>
              <p className="text-xs text-ink-muted">
                Submitted on {formatDateTime12h(selected.created_at)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Subject</p>
              <h3 className="mt-1 font-serif text-xl font-medium text-ink">{selected.subject}</h3>
            </div>

            <div className="grid gap-3 rounded-sm border border-gold-700/15 bg-parchment-100/70 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">Name</p>
                <p className="mt-1 font-heading text-sm font-semibold text-ink">{selected.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">Email</p>
                <div className="mt-1 flex items-center gap-2">
                  <a
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}
                    className="text-sm text-gold-700 hover:underline break-all"
                  >
                    {selected.email}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(selected.email, "email")}
                    className="text-xs text-ink-muted hover:text-ink"
                    title="Copy email"
                  >
                    {copiedField === "email" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">Phone</p>
                <div className="mt-1 flex items-center gap-2">
                  <a
                    href={`tel:${selected.phone}`}
                    className="font-mono text-sm text-gold-700 hover:underline"
                  >
                    {selected.phone}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(selected.phone, "phone")}
                    className="text-xs text-ink-muted hover:text-ink"
                    title="Copy phone"
                  >
                    {copiedField === "phone" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Description</p>
              <div className="mt-2 max-h-72 overflow-y-auto rounded-sm border border-gold-700/15 bg-parchment-50 p-4 font-sans text-sm leading-relaxed text-ink whitespace-pre-wrap">
                {selected.description}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold-700/20 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">Set status:</span>
                {selected.status !== "RESOLVED" && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleStatusChange("RESOLVED")}
                  >
                    Mark as Resolved
                  </Button>
                )}
                {selected.status !== "PENDING" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleStatusChange("PENDING")}
                  >
                    Reopen (Pending)
                  </Button>
                )}
                {selected.status !== "ARCHIVED" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleStatusChange("ARCHIVED")}
                  >
                    Archive
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-gold-700/30 px-3 text-xs font-medium text-gold-700 hover:bg-parchment-200"
                >
                  <HiOutlineMail className="h-4 w-4" /> Reply via Mail
                </a>
                <a
                  href={`tel:${selected.phone}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-gold-700/30 px-3 text-xs font-medium text-gold-700 hover:bg-parchment-200"
                >
                  <HiOutlinePhone className="h-4 w-4" /> Call
                </a>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
