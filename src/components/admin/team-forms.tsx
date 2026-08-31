"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  deleteTeamMemberAction,
  saveTeamMemberAction,
  updateContactDeskFacesAction,
  type FormState,
} from "@/app/actions/cms";
import { AdminTable } from "@/components/admin/admin-filters";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { SquareImageField } from "@/components/ui/square-image-field";
import { Modal, ModalTrigger } from "@/components/ui/modal";
import { splitOfficerNames } from "@/lib/team";
import { SQUARE_CARD_HINT } from "@/lib/upload";
import type { ContactDeskFaceRef, TeamMember, TeamSection } from "@/types";

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
      <div className="sm:col-span-2">
        <SquareImageField
          htmlFor={`photo-${suffix}`}
          fileName="photo_file"
          removeName="remove_photo"
          currentUrl={member?.photo_url}
          label="Photo (1:1 1080p)"
          hint={SQUARE_CARD_HINT}
        />
      </div>
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

type FaceOption = {
  member_id: string;
  name: string;
  label: string;
};

function faceOptionKey(memberId: string, name: string) {
  return `${memberId}::${name}`;
}

function parseFaceOptionKey(value: string): { member_id: string; name: string } | null {
  const sep = value.indexOf("::");
  if (sep <= 0) return null;
  const member_id = value.slice(0, sep);
  const name = value.slice(sep + 2);
  if (!member_id || !name) return null;
  return { member_id, name };
}

export function ContactDeskFacesForm({
  members,
  faces,
  limit,
  readOnly,
}: {
  members: TeamMember[];
  faces: ContactDeskFaceRef[];
  limit: number;
  readOnly: boolean;
}) {
  const options = useMemo(() => {
    const rows: FaceOption[] = [];
    for (const member of members) {
      if (!member.full_name.trim()) continue;
      for (const name of splitOfficerNames(member.full_name)) {
        rows.push({
          member_id: member.id,
          name,
          label: `${name} — ${member.role_title}`,
        });
      }
    }
    return rows;
  }, [members]);

  const optionByKey = useMemo(() => {
    const map = new Map<string, FaceOption>();
    for (const option of options) {
      map.set(faceOptionKey(option.member_id, option.name), option);
    }
    return map;
  }, [options]);

  const [rows, setRows] = useState(() => faces.map((face) => faceOptionKey(face.member_id, face.name)));
  const [pendingAdd, setPendingAdd] = useState("");
  const [state, formAction, pending] = useActionState(updateContactDeskFacesAction, {} as FormState);

  if (readOnly) {
    const shown = faces.slice(0, limit);
    return (
      <div className="text-sm">
        <p className="text-ink-muted">Display limit: {limit}</p>
        {shown.length ? (
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            {shown.map((face) => {
              const option = optionByKey.get(faceOptionKey(face.member_id, face.name));
              return (
                <li key={faceOptionKey(face.member_id, face.name)}>
                  {option?.label ?? `${face.name} (missing from team)`}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 text-ink-muted">
            No faces assigned. Public page shows the first {limit} core officers.
          </p>
        )}
      </div>
    );
  }

  const selectedKeys = new Set(rows);
  const available = options.filter((option) => !selectedKeys.has(faceOptionKey(option.member_id, option.name)));

  return (
    <form action={formAction} className="space-y-4">
      <Field
        label="Display limit"
        htmlFor="contact_desk_limit"
        hint="How many names to show on /contact (after order)."
      >
        <Input
          id="contact_desk_limit"
          name="contact_desk_limit"
          type="number"
          min={0}
          max={24}
          defaultValue={limit}
          required
        />
      </Field>

      <input type="hidden" name="face_count" value={rows.length} />
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Assigned faces (order top → bottom)</p>
        {rows.length ? (
          <ul className="space-y-2">
            {rows.map((key, index) => {
              const parsed = parseFaceOptionKey(key);
              const option = optionByKey.get(key);
              const label = option?.label ?? (parsed ? `${parsed.name} (missing)` : key);
              return (
                <li
                  key={`${key}-${index}`}
                  className="flex flex-wrap items-center gap-2 border border-gold-700/15 bg-parchment-50/80 px-3 py-2"
                >
                  <span className="w-6 text-xs font-semibold text-gold-700">{index + 1}</span>
                  <span className="min-w-0 flex-1 text-sm">{label}</span>
                  {parsed ? (
                    <>
                      <input type="hidden" name={`face_member_${index}`} value={parsed.member_id} />
                      <input type="hidden" name={`face_name_${index}`} value={parsed.name} />
                    </>
                  ) : null}
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={index === 0}
                      onClick={() =>
                        setRows((current) => {
                          if (index === 0) return current;
                          const next = [...current];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          return next;
                        })
                      }
                    >
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={index === rows.length - 1}
                      onClick={() =>
                        setRows((current) => {
                          if (index >= current.length - 1) return current;
                          const next = [...current];
                          [next[index], next[index + 1]] = [next[index + 1], next[index]];
                          return next;
                        })
                      }
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            None selected. Public page falls back to the first core officers up to the display limit.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1">
          <Field label="Add face" htmlFor="add_desk_face">
            <Select
              id="add_desk_face"
              value={pendingAdd}
              onChange={(event) => setPendingAdd(event.target.value)}
              disabled={!available.length}
            >
              <option value="">{available.length ? "Choose from team…" : "No more team faces"}</option>
              {available.map((option) => (
                <option
                  key={faceOptionKey(option.member_id, option.name)}
                  value={faceOptionKey(option.member_id, option.name)}
                >
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={!pendingAdd}
          onClick={() => {
            if (!pendingAdd) return;
            setRows((current) => (current.includes(pendingAdd) ? current : [...current, pendingAdd]));
            setPendingAdd("");
          }}
        >
          Add
        </Button>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save desk faces"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
