import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/site/section";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <Section className="max-w-2xl space-y-6 text-center">
      <p className="font-heading text-6xl font-semibold text-muted-foreground">404</p>
      <h1 className="font-heading text-4xl font-semibold">Сторінку не знайдено</h1>
      <p className="text-lg text-muted-foreground">
        Можливо, подія вже минула або посилання застаріло. Перегляньте актуальний розклад.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/events" className={cn(buttonVariants({ size: "lg" }), "h-11 px-6 text-base")}>
          Розклад подій
        </Link>
        <Link href="/" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 px-6 text-base")}>
          На головну
        </Link>
      </div>
    </Section>
  );
}
