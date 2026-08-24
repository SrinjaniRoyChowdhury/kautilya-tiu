"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { composeContactLetter, type ContactLetterState } from "@/app/actions/contact";
import { CONTACT_DESKS } from "@/lib/contact";

export function ContactLetterForm({ to }: { to: string }) {
  const [state, action, pending] = useActionState(composeContactLetter, {} as ContactLetterState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="to" value={to} />
      {state.error ? (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.mailto ? (
        <p className="rounded-sm bg-parchment-200 px-3 py-2 text-sm text-ink" role="status">
          The letter is ready.{" "}
          <a href={state.mailto} className="font-medium text-gold-700 underline">
            Open your mail app to send it
          </a>
          . Nothing is stored on a paid service.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" error={state.fieldErrors?.name}>
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Your email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
      </div>
      <Field label="Desk" htmlFor="desk" error={state.fieldErrors?.desk}>
        <Select id="desk" name="desk" defaultValue="delegate" required>
          {CONTACT_DESKS.map((desk) => (
            <option key={desk.id} value={desk.id}>
              {desk.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="The letter" htmlFor="message" error={state.fieldErrors?.message}>
        <Textarea
          id="message"
          name="message"
          required
          minLength={12}
          maxLength={2000}
          placeholder="What should the secretariat know?"
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sealing…" : "Seal and open mail"}
      </Button>
    </form>
  );
}
