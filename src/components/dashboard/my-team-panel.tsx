"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignGroupMemberAction, removeGroupMemberAction } from "@/app/actions/groups";
import { GroupEmailPicker } from "@/components/dashboard/group-email-picker";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import type { MyTeamContext } from "@/lib/groups";

export function MyTeamPanel({ context }: { context: MyTeamContext }) {
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const collectiveId = context.kind === "collective" ? context.groupId : null;
  const institutionId = context.kind === "institution" ? context.groupId : null;

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <p className="text-sm text-ink-muted">
        You represent <span className="font-medium text-ink">{context.groupName}</span> (
        {context.kind === "collective" ? "collective" : "institution"}). Add or remove members for
        the current edition by searching their registered email.
      </p>

      <GroupEmailPicker
        editionId={context.editionId}
        collectiveId={collectiveId}
        institutionId={institutionId}
        onPick={(delegate) =>
          run(() => assignGroupMemberAction(delegate.registration_id, collectiveId, institutionId))
        }
      />
      <ActionFeedback {...feedback} />

      {context.members.length ? (
        <ul className="divide-y divide-gold-700/10 rounded-sm border border-gold-700/15">
          {context.members.map((member) => (
            <li
              key={member.registration_id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{member.full_name}</p>
                <p className="text-xs text-ink-muted">
                  {member.email}
                  {member.committee_short_name ? ` · ${member.committee_short_name}` : ""} ·{" "}
                  {member.status}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => removeGroupMemberAction(member.registration_id, context.kind))
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No members in your group yet.</p>
      )}
    </div>
  );
}
