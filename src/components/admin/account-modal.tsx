"use client";

import { useState } from "react";
import { CreateAccountForm } from "@/components/admin/account-forms";
import { Modal, ModalTrigger } from "@/components/ui/modal";
import type { Edition } from "@/types";
import type { AccountKind } from "@/lib/username";

export function CreateAccountModalButton({
  editions,
  defaultKind,
  label = "Add account",
  allowedKinds,
}: {
  editions: Edition[];
  defaultKind?: AccountKind;
  label?: string;
  allowedKinds?: readonly AccountKind[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ModalTrigger label={label} onOpen={() => setOpen(true)} />
      <Modal open={open} title={label} onClose={() => setOpen(false)} wide>
        <CreateAccountForm
          editions={editions}
          defaultKind={defaultKind}
          lockKind={Boolean(defaultKind)}
          allowedKinds={allowedKinds}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
