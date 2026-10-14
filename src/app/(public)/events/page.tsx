import type { Metadata } from "next";
import { EventGrid } from "@/components/site/event-card";
import { Section, SectionTitle } from "@/components/site/section";
import { tryGetUpcomingEvents } from "@/lib/events";

export const metadata: Metadata = {
  title: "Події",
  description: "Тренування, майстер-класи та коучинг для жінок. Розклад і запис онлайн.",
};
export default async function EventsPage() {
  const { events, failed } = await tryGetUpcomingEvents();
  return (
    <Section>
      <SectionTitle title="Події" subtitle="Тренування, майстер-класи та коучинг. Оберіть подію та запишіться онлайн." />
      {failed ? (
        <p className="text-muted-foreground">Розклад тимчасово недоступний. Спробуйте пізніше.</p>
      ) : events.length ? (
        <EventGrid events={events} />
      ) : (
        <p className="text-muted-foreground">Нових подій поки немає — слідкуйте за анонсами в Instagram.</p>
      )}
    </Section>
  );
}
