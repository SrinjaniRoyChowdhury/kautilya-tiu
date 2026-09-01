import { describe, expect, it } from "vitest";
import { HELP_DESK_TYPES, type HelpDeskQuery } from "@/types";
import { inDateRange, matchesQuery } from "./search";
import { isTenDigitPhone } from "./phone";

describe("Help Desk types and validation", () => {
  it("defines the expected Help Desk query types", () => {
    expect(HELP_DESK_TYPES).toEqual([
      "Delegate Queries",
      "Partnership",
      "Press and Faculty",
    ]);
  });

  it("validates 10-digit phone numbers for queries", () => {
    expect(isTenDigitPhone("9049064408")).toBe(true);
    expect(isTenDigitPhone("1234567890")).toBe(true);
    expect(isTenDigitPhone("12345")).toBe(false);
    expect(isTenDigitPhone("abcdefghij")).toBe(false);
  });
});

describe("Help Desk filtering", () => {
  const sampleQueries: HelpDeskQuery[] = [
    {
      id: "1",
      name: "Aarav Sharma",
      email: "aarav@example.com",
      phone: "9876543210",
      type: "Delegate Queries",
      subject: "Allotment matrix clarification",
      description: "Need guidance on portfolio allocation for UNSC.",
      status: "PENDING",
      created_at: "2026-09-01T10:00:00.000Z",
      updated_at: "2026-09-01T10:00:00.000Z",
    },
    {
      id: "2",
      name: "Priya Patel",
      email: "priya@sponsorcorp.com",
      phone: "9123456780",
      type: "Partnership",
      subject: "Title sponsorship proposal",
      description: "We would like to partner as Title Sponsor for Kautilya 2026.",
      status: "RESOLVED",
      created_at: "2026-09-01T12:30:00.000Z",
      updated_at: "2026-09-01T14:00:00.000Z",
    },
    {
      id: "3",
      name: "Dr. Roy",
      email: "roy@university.edu",
      phone: "9988776655",
      type: "Press and Faculty",
      subject: "Faculty advisor accreditation",
      description: "Requesting formal delegation entry pass for our faculty advisors.",
      status: "PENDING",
      created_at: "2026-08-25T08:00:00.000Z",
      updated_at: "2026-08-25T08:00:00.000Z",
    },
  ];

  it("filters queries by type", () => {
    const delegateOnly = sampleQueries.filter((q) => q.type === "Delegate Queries");
    expect(delegateOnly).toHaveLength(1);
    expect(delegateOnly[0].name).toBe("Aarav Sharma");

    const partnershipOnly = sampleQueries.filter((q) => q.type === "Partnership");
    expect(partnershipOnly).toHaveLength(1);
    expect(partnershipOnly[0].name).toBe("Priya Patel");

    const pressOnly = sampleQueries.filter((q) => q.type === "Press and Faculty");
    expect(pressOnly).toHaveLength(1);
    expect(pressOnly[0].name).toBe("Dr. Roy");
  });

  it("searches queries by name, email, phone, subject, or description", () => {
    const matchSubject = sampleQueries.filter((q) =>
      matchesQuery("sponsorship", q.name, q.email, q.phone, q.subject, q.description),
    );
    expect(matchSubject).toHaveLength(1);
    expect(matchSubject[0].type).toBe("Partnership");

    const matchEmail = sampleQueries.filter((q) =>
      matchesQuery("aarav@example.com", q.name, q.email, q.phone, q.subject, q.description),
    );
    expect(matchEmail).toHaveLength(1);

    const matchPhone = sampleQueries.filter((q) =>
      matchesQuery("9988776655", q.name, q.email, q.phone, q.subject, q.description),
    );
    expect(matchPhone).toHaveLength(1);
    expect(matchPhone[0].name).toBe("Dr. Roy");
  });

  it("filters queries by date range", () => {
    const septemberQueries = sampleQueries.filter((q) =>
      inDateRange(q.created_at, "2026-09-01", "2026-09-02"),
    );
    expect(septemberQueries).toHaveLength(2);

    const augustQueries = sampleQueries.filter((q) =>
      inDateRange(q.created_at, "2026-08-20", "2026-08-26"),
    );
    expect(augustQueries).toHaveLength(1);
    expect(augustQueries[0].name).toBe("Dr. Roy");
  });
});
