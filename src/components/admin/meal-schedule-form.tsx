"use client";

import { useActionState } from "react";
import { addMealTypeAction, type OpsState } from "@/app/actions/ops";
import { Button } from "@/components/ui/button";
import type { MealSchedule } from "@/types";

export function MealScheduleForm({
  editionId,
  meals,
}: {
  editionId: string;
  meals: MealSchedule[];
}) {
  const action = addMealTypeAction.bind(null, editionId);
  const [state, formAction, pending] = useActionState(action, {} as OpsState);
  const grouped = [1, 2, 3].map((day) => ({
    day,
    names: meals.filter((meal) => meal.event_day === day).map((meal) => meal.name),
  }));

  return (
    <div className="grid gap-4">
      {state.error ? (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-sm bg-parchment-200 px-3 py-2 text-sm" role="status">
          {state.success}
        </p>
      ) : null}
      <ul className="grid gap-2 text-sm">
        {grouped.map((group) => (
          <li key={group.day}>
            <span className="font-medium">Day {group.day}:</span> {group.names.join(", ") || "None"}
          </li>
        ))}
      </ul>
      <form action={formAction}>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Set lunch and evening snacks for all days"}
        </Button>
      </form>
    </div>
  );
}
