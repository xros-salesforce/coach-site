import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, Clock, MapPin, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/site/section";
import { getEventBySlug } from "@/lib/events";
import { formatDate, formatPrice, formatTimeRange, pluralSeats } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const event = await getEventBySlug(slug).catch(() => null);
  return event ? { title: event.title, description: event.description.slice(0, 160) } : {};
}

// Params are awaited inside Suspense so the shell prerenders; any slug is served at request time.
export default function EventPage(props: PageProps<"/events/[slug]">) {
  return (
    <Suspense fallback={<EventSkeleton />}>
      <EventDetails params={props.params} />
    </Suspense>
  );
}

function EventSkeleton() {
  return (
    <Section className="grid gap-10 md:grid-cols-[1fr_380px]" aria-busy="true">
      <div className="space-y-4">
        <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
        <div className="h-12 w-3/4 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
    </Section>
  );
}

async function EventDetails({ params }: Pick<PageProps<"/events/[slug]">, "params">) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const full = event.seats_left <= 0;
  const facts = [
    { icon: CalendarDays, text: formatDate(event.starts_at) },
    { icon: Clock, text: formatTimeRange(event.starts_at, event.ends_at) },
    event.location && { icon: MapPin, text: event.location },
    { icon: Wallet, text: formatPrice(event.price_uah) },
    { icon: Users, text: full ? "Місць немає — можна стати в лист очікування" : `Вільно ${pluralSeats(event.seats_left)}` },
  ].filter((f) => !!f);

  return (
    <Section className="grid gap-10 md:grid-cols-[1fr_380px]">
      <article>
        <Badge variant="secondary" className="mb-4">{event.type_name}</Badge>
        <h1 className="font-heading text-4xl font-semibold md:text-5xl">{event.title}</h1>
        <ul className="mt-6 space-y-2 text-muted-foreground">
          {facts.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 first-letter:uppercase">
              <Icon className="size-4 shrink-0" />
              {text}
            </li>
          ))}
        </ul>
        <div className="mt-8 whitespace-pre-line text-lg leading-relaxed">{event.description}</div>
      </article>
      <aside id="register" className="h-fit rounded-xl border bg-card p-6">
        <h2 className="font-heading text-2xl font-semibold">{full ? "Лист очікування" : "Реєстрація"}</h2>
        {/* Registration form arrives in phase 4. */}
        <p className="mt-2 text-sm text-muted-foreground">Форма реєстрації незабаром.</p>
      </aside>
    </Section>
  );
}
