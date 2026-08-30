"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createCollectiveAction,
  deleteCollectiveAction,
  updateCollectiveAction,
  type CollectiveState,
} from "@/app/actions/collectives";
import {
  createInstitutionAction,
  deleteInstitutionAction,
  updateInstitutionAction,
  type InstitutionState,
} from "@/app/actions/institutions";
import { loadGroupDetailAction } from "@/app/actions/groups";
import { GroupManagePanel } from "@/components/admin/group-manage-panel";
import { AdminTable } from "@/components/admin/admin-filters";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { Modal, ModalTrigger } from "@/components/ui/modal";
import type { GroupDetail } from "@/lib/groups";
import type { Collective, Institution } from "@/types";

type NamedState = CollectiveState | InstitutionState;

function CreateNamedForm({
  action,
  fieldId,
  label,
  onSuccess,
}: {
  action: (prev: NamedState, formData: FormData) => Promise<NamedState>;
  fieldId: string;
  label: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, {} as NamedState);
  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="grid gap-3">
      <Field label={label} htmlFor={fieldId}>
        <Input id={fieldId} name="name" required minLength={2} maxLength={120} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}

export function CreateCollectiveModalButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ModalTrigger label="Add collective" onOpen={() => setOpen(true)} />
      <Modal open={open} title="Add collective" onClose={() => setOpen(false)}>
        <CreateNamedForm
          action={createCollectiveAction}
          fieldId="collective_name"
          label="Collective name"
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

export function CreateInstitutionModalButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ModalTrigger label="Add institution" onOpen={() => setOpen(true)} />
      <Modal open={open} title="Add institution" onClose={() => setOpen(false)}>
        <CreateNamedForm
          action={createInstitutionAction}
          fieldId="institution_name"
          label="Institution name"
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function EditNamedModal({
  row,
  title,
  update,
  remove,
  onClose,
}: {
  row: { id: string; name: string };
  title: string;
  update: (id: string, prev: NamedState, formData: FormData) => Promise<NamedState>;
  remove: (id: string, prev: NamedState, formData: FormData) => Promise<NamedState>;
  onClose: () => void;
}) {
  const save = update.bind(null, row.id);
  const drop = remove.bind(null, row.id);
  const [state, action, pending] = useActionState(save, {} as NamedState);
  const [deleteState, deleteAction, deleting] = useActionState(drop, {} as NamedState);

  useEffect(() => {
    if (state.success || deleteState.success) onClose();
  }, [state.success, deleteState.success, onClose]);

  return (
    <Modal open title={title} onClose={onClose}>
      <form action={action} className="grid gap-3">
        <Field label="Name" htmlFor={`edit-${row.id}`}>
          <Input id={`edit-${row.id}`} name="name" defaultValue={row.name} required />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || deleting}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <ActionFeedback error={state.error} success={state.success} />
      </form>
      <form action={deleteAction} className="mt-4 border-t border-gold-700/15 pt-4">
        <Button type="submit" variant="ghost" size="sm" disabled={pending || deleting}>
          {deleting ? "Removing…" : "Delete"}
        </Button>
        <ActionFeedback error={deleteState.error} success={deleteState.success} className="text-xs" />
      </form>
    </Modal>
  );
}

function ManageGroupModal({
  row,
  kind,
  editionId,
  onClose,
}: {
  row: { id: string; name: string };
  kind: "collective" | "institution";
  editionId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const loaded = await loadGroupDetailAction(kind, row.id, editionId);
      if (!loaded) setError("Could not load group details.");
      else setDetail(loaded);
    });
  }, [kind, row.id, editionId]);

  return (
    <Modal
      open
      title={`Manage ${kind === "collective" ? "collective" : "institution"}: ${row.name}`}
      onClose={onClose}
    >
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {!detail && !error ? <p className="text-sm text-ink-muted">Loading…</p> : null}
      {detail ? (
        <GroupManagePanel detail={detail} editionId={editionId} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

function NamedRowActions({
  row,
  title,
  kind,
  editionId,
  update,
  remove,
}: {
  row: { id: string; name: string };
  title: string;
  kind: "collective" | "institution";
  editionId: string;
  update: (id: string, prev: NamedState, formData: FormData) => Promise<NamedState>;
  remove: (id: string, prev: NamedState, formData: FormData) => Promise<NamedState>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setManageOpen(true)}>
          Manage
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
      </div>
      {editOpen ? (
        <EditNamedModal row={row} title={title} update={update} remove={remove} onClose={() => setEditOpen(false)} />
      ) : null}
      {manageOpen ? (
        <ManageGroupModal
          row={row}
          kind={kind}
          editionId={editionId}
          onClose={() => setManageOpen(false)}
        />
      ) : null}
    </>
  );
}

export function CollectiveTable({
  rows,
  readOnly,
  editionId,
}: {
  rows: Collective[];
  readOnly: boolean;
  editionId: string;
}) {
  if (!rows.length) return <p className="text-sm text-ink-muted">No collectives yet.</p>;
  return (
    <AdminTable columns={readOnly ? ["Name"] : ["Name", ""]}>
      {rows.map((row) => (
        <tr key={row.id} className="border-b border-gold-700/10 hover:bg-parchment-100">
          <td className="px-2 py-1.5">{row.name}</td>
          {readOnly ? null : (
            <td className="px-2 py-1.5 text-right">
              <NamedRowActions
                row={row}
                title="Edit collective"
                kind="collective"
                editionId={editionId}
                update={updateCollectiveAction}
                remove={deleteCollectiveAction}
              />
            </td>
          )}
        </tr>
      ))}
    </AdminTable>
  );
}

export function InstitutionTable({
  rows,
  readOnly,
  editionId,
}: {
  rows: Institution[];
  readOnly: boolean;
  editionId: string;
}) {
  if (!rows.length) return <p className="text-sm text-ink-muted">No institutions yet.</p>;
  return (
    <AdminTable columns={readOnly ? ["Name"] : ["Name", ""]}>
      {rows.map((row) => (
        <tr key={row.id} className="border-b border-gold-700/10 hover:bg-parchment-100">
          <td className="px-2 py-1.5">{row.name}</td>
          {readOnly ? null : (
            <td className="px-2 py-1.5 text-right">
              <NamedRowActions
                row={row}
                title="Edit institution"
                kind="institution"
                editionId={editionId}
                update={updateInstitutionAction}
                remove={deleteInstitutionAction}
              />
            </td>
          )}
        </tr>
      ))}
    </AdminTable>
  );
}
