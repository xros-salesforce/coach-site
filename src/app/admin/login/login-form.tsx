"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LoginState, sendSignInLink } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(sendSignInLink, { status: "idle" } as LoginState);

  if (state.status === "sent") {
    return (
      <div className="space-y-2" role="status">
        <p className="font-medium">Перевірте пошту</p>
        <p className="text-sm text-muted-foreground">
          Якщо {state.email} має доступ до адмінки, на нього прийшов лист із посиланням для входу. Посилання діє 1 годину.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} className="h-10" />
      </div>
      {state.status === "invalid" && <p className="text-sm text-destructive">Перевірте адресу email.</p>}
      {state.status === "rate_limited" && (
        <p className="text-sm text-destructive">Забагато спроб. Зачекайте кілька хвилин і спробуйте знову.</p>
      )}
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? "Надсилаємо…" : "Надіслати посилання для входу"}
      </Button>
    </form>
  );
}
