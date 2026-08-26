import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditionForm } from "@/components/admin/forms";
import { PhaseActivateList } from "@/components/admin/phase-forms";
import { PaymentInstructionsForm } from "@/components/admin/payment-instructions-form";
import { MealScheduleForm } from "@/components/admin/meal-schedule-form";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getEditionById, getMealSchedules, getPaymentInstructions, getRegistrationPhases } from "@/lib/data";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit edition" };

export default async function EditEditionPage({ params }: Props) {
  const { id } = await params;
  const edition = await getEditionById(id);
  if (!edition) notFound();
  const instructions = await getPaymentInstructions(edition.id);
  const meals = await getMealSchedules(edition.id);
  const phases = await getRegistrationPhases(edition.id);

  return (
    <Container className="py-12">
      <PageHeader eyebrow="Admin" title={edition.name} />
      <Card>
        <EditionForm edition={edition} />
      </Card>
      <Card className="mt-6">
        <p className="mb-2 font-serif text-2xl text-gold-700">Registration phase</p>
        <p className="mb-4 text-sm text-ink-muted">
          Only one phase is active. Committee fees and new registration amounts follow the active
          phase. Existing submissions keep the fee snapshotted at submit.
        </p>
        <PhaseActivateList phases={phases} />
      </Card>
      <Card className="mt-6">
        <p className="mb-4 font-serif text-2xl text-gold-700">Payment instructions</p>
        <p className="mb-6 text-sm text-ink-muted">
          Shown to delegates when they pay. Static UPI / bank details only — no gateway.
        </p>
        <PaymentInstructionsForm editionId={edition.id} instructions={instructions} />
      </Card>
      <Card className="mt-6">
        <p className="mb-4 font-serif text-2xl text-gold-700">Meal schedule</p>
        <p className="mb-6 text-sm text-ink-muted">
          Food desks serve lunch and evening snacks only. This list is created on all three days.
        </p>
        <MealScheduleForm editionId={edition.id} meals={meals} />
      </Card>
    </Container>
  );
}
