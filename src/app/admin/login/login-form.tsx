"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserAuthClient } from "@/lib/supabase/browser";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Status = "idle" | "sending" | "sent" | "invalid" | "captcha" | "rate_limited" | "offline";

const messages: Partial<Record<Status, string>> = {
  invalid: "Перевірте адресу email.",
  captcha: "Підтвердьте, що ви не робот, і спробуйте ще раз.",
  rate_limited: "Посилання вже надіслано. Новий лист можна запросити через хвилину.",
  offline: "Не вдалося надіслати. Перевірте інтернет і спробуйте ще раз.",
};

export function LoginForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = z.email().safeParse(email.trim().toLowerCase());
    if (!parsed.success) return setStatus("invalid");
    if (SITE_KEY && !token) return setStatus("captcha");

    setStatus("sending");
    const { error } = await createBrowserAuthClient().auth.signInWithOtp({
      email: parsed.data,
      options: {
        // Sign-ups are disabled: only accounts created with scripts/add-admin.mts get a link.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/admin`,
        captchaToken: token ?? undefined,
      },
    });
    turnstile.current?.reset(); // a token is single-use

    if (error?.status === 429) setStatus("rate_limited");
    else if (error && /captcha/i.test(error.message)) setStatus("captcha");
    else if (error?.name === "AuthRetryableFetchError") setStatus("offline");
    // Any other outcome (including "no such account") gets the same answer.
    else setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="space-y-2" role="status">
        <p className="font-medium">Перевірте пошту</p>
        <p className="text-sm text-muted-foreground">
          Якщо {email.trim()} має доступ до адмінки, на нього прийшов лист із посиланням для входу. Посилання діє 1 годину.
        </p>
      </div>
    );
  }

  const message = messages[status];
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={status === "invalid" || undefined}
          aria-describedby={message ? "login-message" : undefined}
          className="h-10"
        />
      </div>
      {SITE_KEY && <Turnstile ref={turnstile} siteKey={SITE_KEY} onToken={setToken} />}
      {message && (
        <p id="login-message" className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}
      <Button type="submit" disabled={status === "sending"} className="h-10 w-full">
        {status === "sending" ? "Надсилаємо…" : "Надіслати посилання для входу"}
      </Button>
    </form>
  );
}
