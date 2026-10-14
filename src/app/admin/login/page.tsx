import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вхід в адмінку", robots: { index: false, follow: false } };

const errors: Record<string, string> = {
  link: "Посилання недійсне або застаріло. Запросіть нове.",
  forbidden: "У цього акаунта немає доступу до адмінки.",
};

export default function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-semibold">Адмінка</h1>
          <p className="text-sm text-muted-foreground">Вхід за посиланням на email — без пароля.</p>
        </div>
        <Suspense>
          <LoginError searchParams={props.searchParams} />
        </Suspense>
        <LoginForm />
      </div>
    </main>
  );
}

async function LoginError({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? errors[error] : undefined;
  return message ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null;
}
