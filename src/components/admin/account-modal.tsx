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
}: {
  editions: Edition[];
  defaultKind?: AccountKind;
  label?: string;
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
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
