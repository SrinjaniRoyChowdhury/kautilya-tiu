"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteTeamMemberAction, saveTeamMemberAction, type FormState } from "@/app/actions/cms";
import { AdminTable } from "@/components/admin/admin-filters";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { Modal, ModalTrigger } from "@/components/ui/modal";
import type { TeamMember, TeamSection } from "@/types";

function Feedback({ state }: { state: FormState }) {
  return <ActionFeedback error={state.error} success={state.success} />;
}

function TeamMemberFields({
  section,
  member,
  nextOrder,
}: {
  section: TeamSection;
  member?: TeamMember;
  nextOrder?: number;
}) {
  const isUsg = section === "USG";
  const suffix = member?.id ?? `new-${section}`;
  const titleLabel = isUsg ? "Department" : "Designation";
  const nameHint = isUsg
    ? "Optional. Co-holders: Name & Name."
    : "Co-holders share one office: Pratik & Nilanjana.";

  return (
    <>
      {member ? <input type="hidden" name="id" value={member.id} /> : null}
      <input type="hidden" name="section" value={section} />
      <Field label={titleLabel} htmlFor={`role-${suffix}`}>
        <Input
          id={`role-${suffix}`}
          name="role_title"
          required
          minLength={2}
          defaultValue={member?.role_title}
          placeholder={isUsg ? "Delegate Affairs" : "Secretary-General"}
        />
      </Field>
      <Field label={isUsg ? "Officer name" : "Name"} htmlFor={`name-${suffix}`} hint={nameHint}>
        <Input
          id={`name-${suffix}`}
          name="full_name"
          required={!isUsg}
          minLength={isUsg ? undefined : 2}
          defaultValue={member?.full_name}
          placeholder={isUsg ? "Optional" : "Name"}
        />
      </Field>
      <Field label="Order" htmlFor={`order-${suffix}`}>
        <Input
          id={`order-${suffix}`}
          name="display_order"
          type="number"
          min={0}
          max={999}
          defaultValue={member?.display_order ?? nextOrder ?? (isUsg ? 100 : 10)}
        />
      </Field>
      <label className="flex items-center gap-2 self-end text-sm">
        <input type="checkbox" name="published" defaultChecked={member?.published ?? true} />
        Published
      </label>
    </>
  );
}

function TeamMemberFormBody({
  section,
  member,
  nextOrder,
  onSuccess,
}: {
  section: TeamSection;
  member?: TeamMember;
  nextOrder?: number;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveTeamMemberAction, {} as FormState);
  const isUsg = section === "USG";

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <TeamMemberFields section={section} member={member} nextOrder={nextOrder} />
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : member ? "Save" : isUsg ? "Add department" : "Add officer"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function AddTeamMemberModalButton({
  section,
  nextOrder,
  label,
}: {
  section: TeamSection;
  nextOrder: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ModalTrigger label={label} onOpen={() => setOpen(true)} />
      <Modal open={open} title={label} onClose={() => setOpen(false)} wide>
        <TeamMemberFormBody section={section} nextOrder={nextOrder} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function EditTeamMemberModal({
  member,
  section,
  onClose,
}: {
  member: TeamMember;
  section: TeamSection;
  onClose: () => void;
}) {
  const [deleteState, deleteAction, deleting] = useActionState(deleteTeamMemberAction, {} as FormState);

  useEffect(() => {
    if (deleteState.success) onClose();
  }, [deleteState.success, onClose]);

  return (
    <Modal
      open
      title={section === "USG" ? "Edit department" : "Edit officer"}
      onClose={onClose}
      wide
    >
      <TeamMemberFormBody section={section} member={member} onSuccess={onClose} />
      <form action={deleteAction} className="mt-4 border-t border-gold-700/15 pt-4">
        <input type="hidden" name="id" value={member.id} />
        <Button type="submit" variant="ghost" size="sm" disabled={deleting}>
          {deleting ? "Removing…" : "Remove"}
        </Button>
        <Feedback state={deleteState} />
      </form>
    </Modal>
  );
}

export function TeamMembersTable({
  members,
  section,
  readOnly,
}: {
  members: TeamMember[];
  section: TeamSection;
  readOnly: boolean;
}) {
  const isUsg = section === "USG";
  const columns = isUsg
    ? readOnly
      ? ["Department", "Officer", "Order"]
      : ["Department", "Officer", "Order", "Published", ""]
    : readOnly
      ? ["Designation", "Name", "Order"]
      : ["Designation", "Name", "Order", "Published", ""];

  if (!members.length) {
    return (
      <p className="text-sm text-ink-muted">
        {isUsg ? "No USG departments yet." : "No core officers yet. The public page shows the fallback roster."}
      </p>
    );
  }

  return (
    <AdminTable columns={columns}>
      {members.map((member) => (
        <TeamMemberRow key={member.id} member={member} section={section} readOnly={readOnly} />
      ))}
    </AdminTable>
  );
}

function TeamMemberRow({
  member,
  section,
  readOnly,
}: {
  member: TeamMember;
  section: TeamSection;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <tr className="border-b border-gold-700/10 hover:bg-parchment-100">
      <td className="px-2 py-1.5 font-medium">{member.role_title}</td>
      <td className="px-2 py-1.5 text-ink-muted">{member.full_name || "—"}</td>
      <td className="px-2 py-1.5 text-ink-muted">{member.display_order}</td>
      {readOnly ? null : (
        <>
          <td className="px-2 py-1.5 text-ink-muted">{member.published ? "Yes" : "No"}</td>
          <td className="px-2 py-1.5 text-right">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
              Edit
            </Button>
            {open ? (
              <EditTeamMemberModal member={member} section={section} onClose={() => setOpen(false)} />
            ) : null}
          </td>
        </>
      )}
    </tr>
  );
}

/** @deprecated use TeamMembersTable + AddTeamMemberModalButton */
export function TeamMemberForm({
  section,
  member,
  nextOrder,
}: {
  section: TeamSection;
  member?: TeamMember;
  nextOrder?: number;
}) {
  return <TeamMemberFormBody section={section} member={member} nextOrder={nextOrder} />;
}
