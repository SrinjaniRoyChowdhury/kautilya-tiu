"use client";

import { useActionState } from "react";
import { manualAttendanceAction, type OpsState } from "@/app/actions/ops";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

export function ManualAttendanceForm() {
  const [state, formAction, pending] = useActionState(manualAttendanceAction, {} as OpsState);
  return (
    <form action={formAction} className="grid gap-4">
      <Field label="Delegate email" htmlFor="email">
        <Input id="email" name="email" type="email" required />
      </Field>
      <Field label="Day" htmlFor="event_day">
        <Select id="event_day" name="event_day" defaultValue="1">
          <option value="1">Day 1</option>
          <option value="2">Day 2</option>
          <option value="3">Day 3</option>
        </Select>
      </Field>
      <Field label="Action" htmlFor="mode">
        <Select id="mode" name="mode" defaultValue="CHECK_IN">
          <option value="CHECK_IN">Manual check-in</option>
          <option value="CHECK_OUT">Manual check-out</option>
          <option value="VOID">Void this day’s record</option>
        </Select>
      </Field>
      <Field label="Reason" htmlFor="reason" hint="Required for audit (FR-ATT-004).">
        <Textarea id="reason" name="reason" required minLength={3} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save correction"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
