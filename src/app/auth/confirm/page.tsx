import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { confirmSignIn } from "./actions";

export const metadata: Metadata = { title: "Вхід в адмінку", robots: { index: false, follow: false } };

// Target of the sign-in email link (supabase/templates/magic_link.html). Shows a button instead of
// signing in on page load, so link scanners that open URLs can't consume the one-time link.
export default function ConfirmPage(props: PageProps<"/auth/confirm">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-semibold">Вхід в адмінку</h1>
          <p className="text-sm text-muted-foreground">Натисніть кнопку, щоб увійти на цьому пристрої.</p>
        </div>
        <Suspense>
          <ConfirmForm searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function ConfirmForm({ searchParams }: Pick<PageProps<"/auth/confirm">, "searchParams">) {
  const sp = await searchParams;
  const value = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return (
    <form action={confirmSignIn}>
      <input type="hidden" name="token_hash" value={value("token_hash")} />
      <input type="hidden" name="type" value={value("type")} />
      <input type="hidden" name="next" value={value("next")} />
      <Button type="submit" className="h-11 w-full text-base">
        Увійти
      </Button>
    </form>
  );
}
