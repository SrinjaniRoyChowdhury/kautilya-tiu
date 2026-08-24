import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { Card, Container, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <Container className="py-12">
      <PageHeader title="Reset password" />
      <Card className="max-w-md">
        <ForgotPasswordForm />
      </Card>
    </Container>
  );
}
