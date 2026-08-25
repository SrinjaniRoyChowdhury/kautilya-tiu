import { describe, expect, it } from "vitest";
import { paymentHrefFromAudit } from "./audit";

describe("paymentHrefFromAudit", () => {
  it("links payment entity rows to the payment page", () => {
    expect(
      paymentHrefFromAudit({
        id: "1",
        actor_user_id: null,
        action: "payment.verify",
        entity: "payments",
        entity_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        old_value: null,
        new_value: null,
        created_at: "",
        actor_name: null,
        actor_email: null,
      }),
    ).toBe("/admin/payments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("does not invent a payment link from an email correction", () => {
    expect(
      paymentHrefFromAudit({
        id: "2",
        actor_user_id: null,
        action: "payment.correct_email",
        entity: "payment_participants",
        entity_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        old_value: { unmatched_email: "a@x.com" },
        new_value: { unmatched_email: "b@x.com" },
        created_at: "",
        actor_name: null,
        actor_email: null,
      }),
    ).toBeNull();
  });
});
