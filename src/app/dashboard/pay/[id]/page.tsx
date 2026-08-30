import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardNav, dashboardNavProps } from "@/components/dashboard/dashboard-nav";
import {
  PaymentInstructionsCard,
  PaymentParticipants,
  PaymentProofForm,
} from "@/components/dashboard/payment-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";
import {
  getPaymentById,
  getPaymentInstructions,
  paymentProofHref,
} from "@/lib/data";
import { paymentEditable } from "@/lib/payments";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Payment details" };

export default async function PaymentDetailPage({ params }: Props) {
  const { id } = await params;
  const [payment, { showTeam }] = await Promise.all([getPaymentById(id), dashboardNavProps()]);
  if (!payment) notFound();
  const instructions = await getPaymentInstructions(payment.edition_id);
  const proofHref = paymentProofHref(payment.id, payment.proof_image_key);
  const editable = paymentEditable(payment.status);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Participant"
        title="Upload proof"
        description="Scan the secretariat QR, transfer the expected total, then attach the screenshot. Staff review is manual."
      />
      <DashboardNav current="/dashboard/pay" showTeam={showTeam} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <PaymentInstructionsCard
            editionId={payment.edition_id}
            instructions={instructions}
            expectedMinor={payment.expected_amount_minor}
          />
        </Card>
        <Card>
          <PaymentProofForm payment={payment} />
          {proofHref ? (
            <p className="mt-4 text-sm">
              <a href={proofHref} className="text-gold-700 hover:underline" target="_blank" rel="noreferrer">
                View uploaded screenshot
              </a>
            </p>
          ) : null}
        </Card>
        <Card className="lg:col-span-2">
          <p className="mb-4 font-serif text-2xl text-gold-700">Participants on this payment</p>
          <PaymentParticipants
            paymentId={payment.id}
            editionId={payment.edition_id}
            participants={payment.payment_participants}
            editable={editable}
          />
        </Card>
      </div>
    </Container>
  );
}
