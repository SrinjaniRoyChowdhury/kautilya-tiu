"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteCollaboratorAction,
  deleteSponsorAction,
  saveCollaboratorAction,
  saveSponsorAction,
  type FormState,
} from "@/app/actions/cms";
import { AdminTable } from "@/components/admin/admin-filters";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { SquareImageField } from "@/components/ui/square-image-field";
import { Modal, ModalTrigger } from "@/components/ui/modal";
import { COLLABORATOR_CATEGORY_OPTIONS, COLLABORATOR_CATEGORY_LABELS } from "@/lib/collaborators";
import { SPONSOR_CATEGORY_OPTIONS, SPONSOR_TIER_LABELS } from "@/lib/sponsors";
import type { CmsCollaborator, CmsSponsor } from "@/types";

function Feedback({ state }: { state: FormState }) {
  return <ActionFeedback error={state.error} success={state.success} />;
}

function SponsorFields({ sponsor, nextOrder }: { sponsor?: CmsSponsor; nextOrder?: number }) {
  const suffix = sponsor?.id ?? "new-sponsor";
  return (
    <>
      {sponsor ? <input type="hidden" name="id" value={sponsor.id} /> : null}
      <Field label="Name" htmlFor={`sponsor-name-${suffix}`}>
        <Input
          id={`sponsor-name-${suffix}`}
          name="name"
          required
          minLength={2}
          defaultValue={sponsor?.name}
          placeholder="Organisation name"
        />
      </Field>
      <Field label="Category" htmlFor={`sponsor-category-${suffix}`}>
        <Select id={`sponsor-category-${suffix}`} name="category" required defaultValue={sponsor?.category ?? "gold"}>
          {SPONSOR_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Order" htmlFor={`sponsor-order-${suffix}`}>
        <Input
          id={`sponsor-order-${suffix}`}
          name="display_order"
          type="number"
          min={0}
          max={999}
          defaultValue={sponsor?.display_order ?? nextOrder ?? 10}
        />
      </Field>
      <label className="flex items-center gap-2 self-end text-sm">
        <input type="checkbox" name="published" defaultChecked={sponsor?.published ?? true} />
        Published
      </label>
      <div className="sm:col-span-2">
        <SquareImageField
          htmlFor={`sponsor-logo-${suffix}`}
          fileName="logo_file"
          removeName="remove_logo"
          currentUrl={sponsor?.logo_url}
          label="Logo"
        />
      </div>
    </>
  );
}

function CollaboratorFields({ collaborator, nextOrder }: { collaborator?: CmsCollaborator; nextOrder?: number }) {
  const suffix = collaborator?.id ?? "new-collaborator";
  return (
    <>
      {collaborator ? <input type="hidden" name="id" value={collaborator.id} /> : null}
      <Field label="Name" htmlFor={`collab-name-${suffix}`}>
        <Input
          id={`collab-name-${suffix}`}
          name="name"
          required
          minLength={2}
          defaultValue={collaborator?.name}
          placeholder="Organisation name"
        />
      </Field>
      <Field label="Category" htmlFor={`collab-category-${suffix}`}>
        <Select
          id={`collab-category-${suffix}`}
          name="category"
          required
          defaultValue={collaborator?.category ?? "society"}
        >
          {COLLABORATOR_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Order" htmlFor={`collab-order-${suffix}`}>
        <Input
          id={`collab-order-${suffix}`}
          name="display_order"
          type="number"
          min={0}
          max={999}
          defaultValue={collaborator?.display_order ?? nextOrder ?? 10}
        />
      </Field>
      <label className="flex items-center gap-2 self-end text-sm">
        <input type="checkbox" name="published" defaultChecked={collaborator?.published ?? true} />
        Published
      </label>
      <div className="sm:col-span-2">
        <SquareImageField
          htmlFor={`collab-logo-${suffix}`}
          fileName="logo_file"
          removeName="remove_logo"
          currentUrl={collaborator?.logo_url}
          label="Logo"
        />
      </div>
    </>
  );
}

function SponsorFormBody({
  sponsor,
  nextOrder,
  onSuccess,
}: {
  sponsor?: CmsSponsor;
  nextOrder?: number;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveSponsorAction, {} as FormState);

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <SponsorFields sponsor={sponsor} nextOrder={nextOrder} />
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : sponsor ? "Save" : "Add sponsor"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

function CollaboratorFormBody({
  collaborator,
  nextOrder,
  onSuccess,
}: {
  collaborator?: CmsCollaborator;
  nextOrder?: number;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveCollaboratorAction, {} as FormState);

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <CollaboratorFields collaborator={collaborator} nextOrder={nextOrder} />
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : collaborator ? "Save" : "Add collaborator"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function AddSponsorModalButton({ nextOrder }: { nextOrder: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ModalTrigger label="Add sponsor" onOpen={() => setOpen(true)} />
      <Modal open={open} title="Add sponsor" onClose={() => setOpen(false)} wide>
        <SponsorFormBody nextOrder={nextOrder} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}

export function AddCollaboratorModalButton({ nextOrder }: { nextOrder: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ModalTrigger label="Add collaborator" onOpen={() => setOpen(true)} />
      <Modal open={open} title="Add collaborator" onClose={() => setOpen(false)} wide>
        <CollaboratorFormBody nextOrder={nextOrder} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function EditSponsorModal({ sponsor, onClose }: { sponsor: CmsSponsor; onClose: () => void }) {
  const [deleteState, deleteAction, deleting] = useActionState(deleteSponsorAction, {} as FormState);

  useEffect(() => {
    if (deleteState.success) onClose();
  }, [deleteState.success, onClose]);

  return (
    <Modal open title="Edit sponsor" onClose={onClose} wide>
      <SponsorFormBody sponsor={sponsor} onSuccess={onClose} />
      <form action={deleteAction} className="mt-4 border-t border-gold-700/15 pt-4">
        <input type="hidden" name="id" value={sponsor.id} />
        <Button type="submit" variant="ghost" size="sm" disabled={deleting}>
          {deleting ? "Removing…" : "Remove"}
        </Button>
        <Feedback state={deleteState} />
      </form>
    </Modal>
  );
}

function EditCollaboratorModal({
  collaborator,
  onClose,
}: {
  collaborator: CmsCollaborator;
  onClose: () => void;
}) {
  const [deleteState, deleteAction, deleting] = useActionState(deleteCollaboratorAction, {} as FormState);

  useEffect(() => {
    if (deleteState.success) onClose();
  }, [deleteState.success, onClose]);

  return (
    <Modal open title="Edit collaborator" onClose={onClose} wide>
      <CollaboratorFormBody collaborator={collaborator} onSuccess={onClose} />
      <form action={deleteAction} className="mt-4 border-t border-gold-700/15 pt-4">
        <input type="hidden" name="id" value={collaborator.id} />
        <Button type="submit" variant="ghost" size="sm" disabled={deleting}>
          {deleting ? "Removing…" : "Remove"}
        </Button>
        <Feedback state={deleteState} />
      </form>
    </Modal>
  );
}

export function SponsorsTable({ sponsors, readOnly }: { sponsors: CmsSponsor[]; readOnly: boolean }) {
  const columns = readOnly
    ? ["Name", "Category", "Order"]
    : ["Name", "Category", "Order", "Published", ""];

  if (!sponsors.length) {
    return <p className="text-sm text-ink-muted">No sponsors yet. The homepage shows placeholder slots.</p>;
  }

  return (
    <AdminTable columns={columns}>
      {sponsors.map((sponsor) => (
        <SponsorRow key={sponsor.id} sponsor={sponsor} readOnly={readOnly} />
      ))}
    </AdminTable>
  );
}

function SponsorRow({ sponsor, readOnly }: { sponsor: CmsSponsor; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <tr className="border-b border-gold-700/10 hover:bg-parchment-100">
      <td className="px-2 py-1.5 font-medium">{sponsor.name}</td>
      <td className="px-2 py-1.5 text-ink-muted">{SPONSOR_TIER_LABELS[sponsor.category]}</td>
      <td className="px-2 py-1.5 text-ink-muted">{sponsor.display_order}</td>
      {readOnly ? null : (
        <>
          <td className="px-2 py-1.5 text-ink-muted">{sponsor.published ? "Yes" : "No"}</td>
          <td className="px-2 py-1.5 text-right">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
              Edit
            </Button>
            {open ? <EditSponsorModal sponsor={sponsor} onClose={() => setOpen(false)} /> : null}
          </td>
        </>
      )}
    </tr>
  );
}

export function CollaboratorsTable({
  collaborators,
  readOnly,
}: {
  collaborators: CmsCollaborator[];
  readOnly: boolean;
}) {
  const columns = readOnly
    ? ["Name", "Category", "Order"]
    : ["Name", "Category", "Order", "Published", ""];

  if (!collaborators.length) {
    return (
      <p className="text-sm text-ink-muted">No collaborators yet. The homepage shows placeholder slots.</p>
    );
  }

  return (
    <AdminTable columns={columns}>
      {collaborators.map((collaborator) => (
        <CollaboratorRow key={collaborator.id} collaborator={collaborator} readOnly={readOnly} />
      ))}
    </AdminTable>
  );
}

function CollaboratorRow({
  collaborator,
  readOnly,
}: {
  collaborator: CmsCollaborator;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <tr className="border-b border-gold-700/10 hover:bg-parchment-100">
      <td className="px-2 py-1.5 font-medium">{collaborator.name}</td>
      <td className="px-2 py-1.5 text-ink-muted">{COLLABORATOR_CATEGORY_LABELS[collaborator.category]}</td>
      <td className="px-2 py-1.5 text-ink-muted">{collaborator.display_order}</td>
      {readOnly ? null : (
        <>
          <td className="px-2 py-1.5 text-ink-muted">{collaborator.published ? "Yes" : "No"}</td>
          <td className="px-2 py-1.5 text-right">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
              Edit
            </Button>
            {open ? (
              <EditCollaboratorModal collaborator={collaborator} onClose={() => setOpen(false)} />
            ) : null}
          </td>
        </>
      )}
    </tr>
  );
}
