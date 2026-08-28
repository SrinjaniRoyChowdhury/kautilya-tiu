"use client";

import { useActionState, useState } from "react";
import { updateCommitteeEbAction, type FormState } from "@/app/actions/committees";
import { AdminTable } from "@/components/admin/admin-filters";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import type { Committee, Edition } from "@/types";

function EbEditModal({
  committee,
  onClose,
}: {
  committee: Committee;
  onClose: () => void;
}) {
  const action = updateCommitteeEbAction.bind(null, committee.id);
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const ebDefault = committee.eb_json?.map((m) => `${m.name} | ${m.title}`).join("\n") ?? "";

  return (
    <Modal open title={`Executive board · ${committee.short_name}`} onClose={onClose} wide>
      <p className="mb-4 text-sm text-ink-muted">
        One member per line: <span className="font-mono">Name | Title</span>
      </p>
      <form action={formAction} className="grid gap-3">
        <Field label="Members" htmlFor={`eb-${committee.id}`}>
          <Textarea id={`eb-${committee.id}`} name="eb_json" rows={8} defaultValue={ebDefault} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save executive board"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <ActionFeedback error={state.error} success={state.success} />
      </form>
    </Modal>
  );
}

function EbRowActions({ committee }: { committee: Committee }) {
  const [open, setOpen] = useState(false);
  const count = committee.eb_json?.length ?? 0;
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {count ? "Edit" : "Add"}
      </Button>
      {open ? <EbEditModal committee={committee} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function CommitteeEbTable({
  committees,
  editionName,
  canEdit = true,
}: {
  committees: Committee[];
  editionName: Record<string, string>;
  canEdit?: boolean;
}) {
  if (!committees.length) {
    return <p className="text-sm text-ink-muted">No committees yet. Create committees first.</p>;
  }

  return (
    <AdminTable columns={["Committee", "Edition", "Members", ""]}>
      {committees.map((committee) => {
        const members = committee.eb_json ?? [];
        return (
          <tr key={committee.id} className="border-b border-gold-700/10 align-top hover:bg-parchment-100">
            <td className="px-2 py-2">
              <p className="font-medium">{committee.short_name}</p>
              <p className="text-xs text-ink-muted">{committee.name}</p>
            </td>
            <td className="px-2 py-2 text-sm text-ink-muted">{editionName[committee.edition_id] ?? "—"}</td>
            <td className="px-2 py-2 text-sm text-ink-muted">
              {members.length ? (
                <ul className="space-y-0.5">
                  {members.slice(0, 3).map((member) => (
                    <li key={`${member.name}-${member.title}`}>
                      {member.name} · {member.title}
                    </li>
                  ))}
                  {members.length > 3 ? <li>+{members.length - 3} more</li> : null}
                </ul>
              ) : (
                "Not set"
              )}
            </td>
            <td className="px-2 py-2 text-right">
              {canEdit ? <EbRowActions committee={committee} /> : null}
            </td>
          </tr>
        );
      })}
    </AdminTable>
  );
}

export function CommitteeEbPreview({ edition }: { edition: Edition | null }) {
  if (!edition) return null;
  return (
    <p className="text-sm text-ink-muted">
      Public page{" "}
      <a href="/executive-board" className="text-gold-700 hover:underline">
        /executive-board
      </a>{" "}
      shows a placeholder until you publish members here and on committee pages.
    </p>
  );
}
