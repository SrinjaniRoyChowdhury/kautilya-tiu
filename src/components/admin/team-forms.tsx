"use client";

import { useActionState } from "react";
import { deleteTeamMemberAction, saveTeamMemberAction, type FormState } from "@/app/actions/cms";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import type { TeamMember, TeamSection } from "@/types";

function Feedback({ state }: { state: FormState }) {
  return <ActionFeedback error={state.error} success={state.success} />;
}

export function TeamMemberForm({
  section,
  member,
  nextOrder,
}: {
  section: TeamSection;
  member?: TeamMember;
  nextOrder?: number;
}) {
  const [state, formAction, pending] = useActionState(saveTeamMemberAction, {} as FormState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteTeamMemberAction, {} as FormState);
  const isUsg = section === "USG";
  const suffix = member?.id ?? `new-${section}`;
  const titleLabel = isUsg ? "Department" : "Designation";
  const nameHint = isUsg
    ? "Optional. Co-holders: Name & Name."
    : "Co-holders share one office: Pratik & Nilanjana.";

  return (
    <div className="grid gap-3">
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
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
          <Button type="submit" disabled={pending || deleting}>
            {pending ? "Saving…" : member ? "Save" : isUsg ? "Add department" : "Add officer"}
          </Button>
          <Feedback state={state} />
        </div>
      </form>
      {member ? (
        <form action={deleteAction}>
          <input type="hidden" name="id" value={member.id} />
          <Button type="submit" variant="ghost" size="sm" disabled={pending || deleting}>
            {deleting ? "Removing…" : "Remove"}
          </Button>
          <Feedback state={deleteState} />
        </form>
      ) : null}
    </div>
  );
}
