"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { RegistrationStatus } from "@/lib/admin/data";
import { cancelRegistration, markPaid, type RowActionState } from "../../../actions";

export function RowActions({ id, status, name }: { id: string; status: RegistrationStatus; name: string }) {
  const [paidState, paidAction, paying] = useActionState(markPaid, {} as RowActionState);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelRegistration, {} as RowActionState);
  const error = paidState.error ?? cancelState.error;
  const active = status === "confirmed" || status === "pending_payment" || status === "waitlist";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {(status === "pending_payment" || status === "expired") && (
          <form action={paidAction}>
            <input type="hidden" name="registration_id" value={id} />
            <Button type="submit" size="sm" disabled={paying}>
              {paying ? "…" : "Оплачено"}
            </Button>
          </form>
        )}
        {active && (
          <form
            action={cancelAction}
            onSubmit={(e) => {
              if (!confirm(`Скасувати реєстрацію: ${name}? Місце отримає перша з листа очікування.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="registration_id" value={id} />
            <Button type="submit" size="sm" variant="ghost" disabled={cancelling}>
              {cancelling ? "…" : "Скасувати"}
            </Button>
          </form>
        )}
      </div>
      {error && <p className="max-w-56 text-right text-xs text-destructive">{error}</p>}
    </div>
  );
}
