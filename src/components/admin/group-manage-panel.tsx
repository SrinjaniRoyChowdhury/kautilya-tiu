"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  assignGroupMemberAction,
  clearGroupRepresentativeAction,
  loadGroupDetailAction,
  removeGroupMemberAction,
  setGroupRepresentativeAction,
} from "@/app/actions/groups";
import { GroupEmailPicker, RepEmailPicker } from "@/components/dashboard/group-email-picker";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import type { GroupDetail } from "@/lib/groups";

export function GroupManagePanel({
  detail: initialDetail,
  editionId,
  onClose,
}: {
  detail: GroupDetail;
  editionId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState(initialDetail);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const collectiveId = detail.kind === "collective" ? detail.id : null;
  const institutionId = detail.kind === "institution" ? detail.id : null;

  async function refreshDetail() {
    const loaded = await loadGroupDetailAction(detail.kind, detail.id, editionId);
    if (loaded) setDetail(loaded);
    router.refresh();
  }

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.success) await refreshDetail();
    });
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-ink-muted">
          {detail.kind === "collective" ? "Collective" : "Institution"} · {detail.members.length} member
          {detail.members.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="rounded-sm border border-gold-700/15 bg-parchment-100/50 p-4">
        {detail.representative ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-ink">Representative</p>
              <p className="text-sm text-ink-muted">
                {detail.representative.full_name} · {detail.representative.email}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => clearGroupRepresentativeAction(collectiveId, institutionId))
              }
            >
              Remove rep
            </Button>
          </div>
        ) : (
          <RepEmailPicker
            editionId={editionId}
            onPick={(candidate) =>
              run(() =>
                setGroupRepresentativeAction(candidate.user_id, collectiveId, institutionId),
              )
            }
          />
        )}
        <ActionFeedback {...feedback} className="mt-2 text-xs" />
      </div>

      <GroupEmailPicker
        editionId={editionId}
        collectiveId={collectiveId}
        institutionId={institutionId}
        onPick={(delegate) =>
          run(() => assignGroupMemberAction(delegate.registration_id, collectiveId, institutionId))
        }
      />

      {detail.members.length ? (
        <ul className="divide-y divide-gold-700/10 rounded-sm border border-gold-700/15">
          {detail.members.map((member) => (
            <li key={member.registration_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{member.full_name}</p>
                <p className="text-xs text-ink-muted">
                  {member.email}
                  {member.committee_short_name ? ` · ${member.committee_short_name}` : ""} · {member.status}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => removeGroupMemberAction(member.registration_id, detail.kind))
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No members in this group yet for the active edition.</p>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
