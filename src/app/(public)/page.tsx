import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventGrid } from "@/components/site/event-card";
import { Section, SectionTitle } from "@/components/site/section";
import { pillars, site } from "@/content/site";
import { tryGetUpcomingEvents } from "@/lib/events";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const { events, failed } = await tryGetUpcomingEvents(3);

  return (
    <>
      <section className="bg-gradient-to-b from-accent/60 to-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-20 md:py-28">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Тренерка · Коуч · Мама</p>
          <h1 className="max-w-3xl font-heading text-5xl font-semibold leading-tight md:text-6xl">{site.name}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{site.tagline}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/events" className={cn(buttonVariants({ size: "lg" }), "h-11 px-6 text-base")}>
              Розклад подій
            </Link>
            <Link href="/about" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 px-6 text-base")}>
              Про мене
            </Link>
          </div>
        </div>
      </section>

      <Section>
        <SectionTitle title="Про що я говорю" subtitle="Чотири теми, з якими я працюю щодня — у блозі та з клієнтками." />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <Card key={p.title}>
              <CardHeader>
                <CardTitle className="font-heading text-xl">{p.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{p.text}</CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <div className="flex items-end justify-between gap-4">
          <SectionTitle title="Найближчі події" />
          <Link href="/events" className={cn(buttonVariants({ variant: "link" }), "mb-8")}>
            Усі події →
          </Link>
        </div>
        {failed ? (
          <p className="text-muted-foreground">Розклад тимчасово недоступний. Спробуйте пізніше.</p>
        ) : events.length ? (
          <EventGrid events={events} />
        ) : (
          <p className="text-muted-foreground">Нових подій поки немає — слідкуйте за анонсами в Instagram.</p>
        )}
      </Section>
    </>
  );
}
