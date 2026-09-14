import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AllocateRegistrationForm } from "@/components/admin/allocation-form";
import {
  DeleteParticipantForm,
  ConfirmFreeParticipantForm,
  ParticipantPasswordForm,
} from "@/components/admin/participant-forms";
import { Container } from "@/components/ui/card";
import { hasPermission, isProtectedAdminAccount } from "@/lib/auth";
import { getAdminParticipant, getCommitteesForEdition } from "@/lib/data";
import { formatDelegation, formatInrFromMinor } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { SECTION_LABELS } from "@/lib/registration";
import type { AdminParticipantDetail, AdminParticipantPartner, FieldSection } from "@/types";

export const metadata: Metadata = { title: "Participant" };

const STATUS_COPY: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting allocation",
  PAYMENT_PENDING: "Awaiting payment",
  PAYMENT_VERIFIED: "Payment verified",
  PAYMENT_REJECTED: "Payment rejected",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const text = value?.trim() ? value : "—";
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 border-b border-gold-700/10 py-1.5 text-sm last:border-b-0 sm:grid-cols-[9rem_1fr]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{text}</dd>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-sm border border-gold-700/20 bg-parchment-50/80 ${className}`}>
      <h2 className="border-b border-gold-700/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">
        {title}
      </h2>
      <div className="px-3 py-2">{children}</div>
    </section>
  );
}

function PartnerBlock({ partner }: { partner: AdminParticipantPartner }) {
  return (
    <Panel title="Co-delegate">
      <dl>
        <DetailRow label="Name" value={partner.full_name} />
        <DetailRow label="Email" value={partner.email} />
        <DetailRow label="Phone" value={partner.phone} />
        <DetailRow label="Role" value={partner.is_pair_lead ? "Pair lead" : "Co-delegate"} />
        <DetailRow label="Status" value={STATUS_COPY[partner.status] ?? partner.status} />
        <DetailRow
          label="Payment"
          value={
            partner.confirmed_free
              ? "Free confirmation"
              : partner.paid
                ? "Verified / under review"
                : "Not paid"
          }
        />
        <DetailRow label="Collective" value={partner.collective_name} />
        <DetailRow label="Institution" value={partner.institution_name} />
        <DetailRow label="Food" value={partner.food_preference} />
        <DetailRow
          label="Allotment"
          value={formatDelegation(partner.allocated_slr, partner.allocated_portfolio)}
        />
        <DetailRow label="Credential" value={partner.display_code} />
      </dl>
      <p className="mt-2">
        <Link href={`/admin/participants/${partner.id}`} className="text-xs text-gold-700 hover:underline">
          Open co-delegate record →
        </Link>
      </p>
    </Panel>
  );
}

function FieldsBlock({ fields }: { fields: AdminParticipantDetail["fields"] }) {
  if (!fields.length) {
    return <p className="text-sm text-ink-muted">No registration fields for this edition.</p>;
  }
  const sections = fields.reduce<Record<string, typeof fields>>((acc, field) => {
    const key = field.section;
    (acc[key] ??= []).push(field);
    return acc;
  }, {});
  return (
    <div className="grid gap-3">
      {(Object.keys(sections) as FieldSection[]).map((section) => (
        <div key={section}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-700/80">
            {SECTION_LABELS[section]}
          </p>
          <dl>
            {sections[section].map((field) => (
              <DetailRow key={`${section}-${field.label}`} label={field.label} value={field.value} />
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export default async function AdminParticipantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const canView = await hasPermission("registration.view");
  if (!canView) {
    return (
      <Container className="py-8">
        <h1 className="font-serif text-2xl text-gold-700">Participant</h1>
        <p className="mt-2 text-sm text-ink-muted">You need registration.view.</p>
      </Container>
    );
  }

  const participant = await getAdminParticipant(id);
  if (!participant) notFound();
  const committees = await getCommitteesForEdition(participant.edition_id);
  const canEdit = await hasPermission("registration.edit", participant.edition_id);
  const protectedAdmin = await isProtectedAdminAccount(participant.user_id, participant.email);
  const canChangePassword = protectedAdmin
    ? await hasPermission("users.manage")
    : canEdit;

  const paymentLabel = participant.confirmed_free
    ? "Free confirmation"
    : participant.paid
      ? "Verified / under review"
      : participant.status === "SUBMITTED"
        ? "Awaiting allocation"
        : "Not paid";

  const allotment = formatDelegation(participant.allocated_slr, participant.allocated_portfolio);
  const prefs = participant.preferences ?? [];

  return (
    <Container className="py-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <Link href="/admin/participants" className="text-xs text-gold-700 hover:underline">
            ← Participants
          </Link>
          <h1 className="mt-1 font-serif text-2xl leading-tight text-gold-700 sm:text-3xl">
            {participant.full_name}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {participant.email}
            {participant.edition_name ? ` · ${participant.edition_name}` : ""}
            {participant.committee_short_name ? ` · ${participant.committee_short_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-sm border border-gold-700/30 bg-parchment-100 px-2 py-1 text-gold-800">
            {STATUS_COPY[participant.status] ?? participant.status}
          </span>
          <span className="rounded-sm border border-gold-700/20 px-2 py-1 text-ink-muted">
            {participant.delegation_type === "DOUBLE" ? "Double del" : "Single del"}
          </span>
          <span className="rounded-sm border border-gold-700/20 px-2 py-1 text-ink-muted">
            {paymentLabel}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <div className="grid gap-3 content-start">
          <Panel title="Profile">
            <dl>
              <DetailRow label="Phone" value={participant.phone} />
              <DetailRow label="Collective" value={participant.collective_name} />
              <DetailRow label="Institution" value={participant.institution_name} />
              <DetailRow label="Food" value={participant.food_preference} />
              <DetailRow label="Delegation" value={participant.delegation_type === "DOUBLE" ? "Double" : "Single"} />
              {participant.delegation_type === "DOUBLE" ? (
                <>
                  <DetailRow
                    label="Pair role"
                    value={
                      participant.is_pair_lead == null
                        ? "—"
                        : participant.is_pair_lead
                          ? "Lead"
                          : "Co-delegate"
                    }
                  />
                  <DetailRow
                    label="Partner"
                    value={
                      participant.partner_name
                        ? `${participant.partner_name}${participant.partner_email ? ` · ${participant.partner_email}` : ""}`
                        : participant.partner_email
                    }
                  />
                </>
              ) : null}
              <DetailRow label="Credential" value={participant.display_code} />
              <DetailRow
                label="Fee"
                value={
                  participant.expected_fee_minor != null
                    ? formatInrFromMinor(participant.expected_fee_minor)
                    : null
                }
              />
              <DetailRow label="Submitted" value={formatWhen(participant.submitted_at)} />
              <DetailRow label="Confirmed" value={formatWhen(participant.confirmed_at)} />
              <DetailRow label="Rules accepted" value={formatWhen(participant.accepted_rules_at)} />
            </dl>
          </Panel>

          <Panel title="Allotment">
            <dl>
              <DetailRow
                label="Committee"
                value={
                  participant.committee_short_name
                    ? `${participant.committee_short_name}${participant.committee_name ? ` · ${participant.committee_name}` : ""}`
                    : null
                }
              />
              <DetailRow label="Portfolio" value={allotment} />
            </dl>
            {prefs.length ? (
              <div className="mt-2 border-t border-gold-700/10 pt-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-700/80">
                  Preferences
                </p>
                <ol className="grid gap-1 text-sm">
                  {prefs.map((pref) => (
                    <li key={`${pref.committee_id}-${pref.preference_order}`}>
                      <span className="text-ink-muted">P{pref.preference_order}.</span>{" "}
                      {pref.committee_short_name ?? "Committee"}
                      {pref.portfolio_1 ? ` · ${pref.portfolio_1}` : ""}
                      {pref.portfolio_2 ? ` / ${pref.portfolio_2}` : ""}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="mt-2 text-xs text-ink-muted">No committee preferences saved.</p>
            )}
          </Panel>

          <Panel title="Registration answers">
            <FieldsBlock fields={participant.fields} />
          </Panel>

          {participant.delegation_type === "DOUBLE" && participant.partner ? (
            <PartnerBlock partner={participant.partner} />
          ) : participant.delegation_type === "DOUBLE" ? (
            <Panel title="Co-delegate">
              <dl>
                <DetailRow label="Partner email" value={participant.partner_email} />
                <DetailRow label="Partner name" value={participant.partner_name} />
              </dl>
              <p className="mt-1 text-xs text-ink-muted">
                No linked co-delegate registration found yet.
              </p>
            </Panel>
          ) : null}
        </div>

        <div className="grid gap-3 content-start">
          {canEdit && !protectedAdmin ? (
            <Panel title="Allocate">
              <AllocateRegistrationForm participant={participant} committees={committees} compact />
            </Panel>
          ) : null}
          {canEdit && !protectedAdmin ? (
            <Panel title="Free confirmation">
              <ConfirmFreeParticipantForm participant={participant} />
            </Panel>
          ) : null}
          {canChangePassword ? (
            <Panel title="Password">
              {protectedAdmin ? (
                <p className="mb-2 text-xs text-ink-muted">Only an admin can set this password.</p>
              ) : null}
              <ParticipantPasswordForm registrationId={participant.id} />
            </Panel>
          ) : null}
          {canEdit && !protectedAdmin ? (
            <Panel title="Delete">
              <DeleteParticipantForm participant={participant} />
            </Panel>
          ) : null}
          {protectedAdmin ? (
            <Panel title="Protected">
              <p className="text-sm text-ink-muted">
                The admin account cannot be deleted. An admin can change its password.
              </p>
            </Panel>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
