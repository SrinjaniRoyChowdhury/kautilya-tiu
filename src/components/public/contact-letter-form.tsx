"use client";

import { useActionState, useState } from "react";
import { HiCheckCircle } from "react-icons/hi";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { submitContactQuery, type ContactQueryState } from "@/app/actions/contact";
import { HELP_DESK_TYPES, type HelpDeskQueryType } from "@/types";
import { phoneInputProps, PHONE_HINT } from "@/lib/phone";

export function ContactLetterForm({
  selectedType: propType,
  onTypeChange,
}: {
  selectedType?: HelpDeskQueryType;
  onTypeChange?: (type: HelpDeskQueryType) => void;
}) {
  const [state, action, pending] = useActionState(submitContactQuery, {} as ContactQueryState);
  const [internalSelectedType, setInternalSelectedType] = useState<HelpDeskQueryType>(
    propType ?? HELP_DESK_TYPES[0],
  );
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastSuccessState, setLastSuccessState] = useState<ContactQueryState | null>(null);

  // When a new query is submitted successfully, reveal the success card
  if (state.success && state !== lastSuccessState) {
    setLastSuccessState(state);
    setIsDismissed(false);
  }

  const showSuccess = state.success && !isDismissed;
  const currentType = propType ?? internalSelectedType;

  const handleTypeChange = (newType: HelpDeskQueryType) => {
    setInternalSelectedType(newType);
    onTypeChange?.(newType);
  };

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-gold-700/30 bg-parchment-100 p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-700/15 text-gold-700">
          <HiCheckCircle className="h-8 w-8 text-gold-700" />
        </div>
        <h3 className="mt-4 font-serif text-2xl font-semibold text-ink">Query Received</h3>
        <p className="mt-2 max-w-md text-sm text-ink-muted">
          {state.message ?? "Your query has been submitted to the secretariat. We will get back to you shortly."}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Our team monitors the desk regularly and typically responds within 24 hours.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-6"
          onClick={() => setIsDismissed(true)}
        >
          Submit another query
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name *" htmlFor="name" error={state.fieldErrors?.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            placeholder="Full name"
          />
        </Field>
        <Field label="Your email *" htmlFor="email" error={state.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@example.com"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Phone number *"
          htmlFor="phone"
          error={state.fieldErrors?.phone}
          hint={PHONE_HINT}
        >
          <Input
            id="phone"
            name="phone"
            required
            placeholder="10-digit mobile number"
            {...phoneInputProps}
          />
        </Field>

        <Field label="Query type *" htmlFor="type" error={state.fieldErrors?.type}>
          <Select
            id="type"
            name="type"
            value={currentType}
            onChange={(e) => handleTypeChange(e.target.value as HelpDeskQueryType)}
            required
          >
            {HELP_DESK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Subject *" htmlFor="subject" error={state.fieldErrors?.subject}>
        <Input
          id="subject"
          name="subject"
          required
          maxLength={200}
          placeholder="What is your query regarding?"
        />
      </Field>

      <Field label="Description *" htmlFor="description" error={state.fieldErrors?.description}>
        <Textarea
          id="description"
          name="description"
          required
          rows={5}
          minLength={10}
          maxLength={4000}
          placeholder="Please describe your query in detail..."
        />
      </Field>

      <Button type="submit" disabled={pending} className="mt-2 w-full sm:w-auto self-start">
        {pending ? "Submitting query…" : "Submit Query"}
      </Button>

      <ActionFeedback error={state.error} />
    </form>
  );
}
