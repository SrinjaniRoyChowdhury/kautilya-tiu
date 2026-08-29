import type { Metadata } from "next";
import { StaffAccountsList } from "@/components/admin/staff-accounts-list";

export const metadata: Metadata = { title: "Accounts" };

export default function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; page?: string }>;
}) {
  return <StaffAccountsList searchParams={searchParams} />;
}
