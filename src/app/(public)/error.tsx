"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/site/section";

// Shown instead of Next's default error page if a public page fails (e.g. the database is down).
export default function PublicError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Section className="max-w-2xl space-y-6 text-center">
      <h1 className="font-heading text-4xl font-semibold">Щось пішло не так</h1>
      <p className="text-lg text-muted-foreground">Сторінка тимчасово недоступна. Спробуйте ще раз за хвилину.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" className="h-11 px-6 text-base" onClick={() => retry()}>
          Спробувати ще раз
        </Button>
        <Link href="/" className={buttonVariants({ size: "lg", variant: "outline", className: "h-11 px-6 text-base" })}>
          На головну
        </Link>
      </div>
    </Section>
  );
}
