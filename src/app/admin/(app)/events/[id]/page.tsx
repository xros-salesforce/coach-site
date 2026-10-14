import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getEvent, listEventTypes } from "@/lib/admin/data";
import { coverUrl } from "@/lib/events";
import { toKyivInput } from "@/lib/kyiv-time";
import { EventForm } from "../event-form";

// Admin data is always fetched fresh, so navigation waits for it; instant navigation isn't a goal here.
export const instant = false;

export const metadata: Metadata = { title: "Редагування події" };

export default async function EditEventPage(props: PageProps<"/admin/events/[id]">) {
  const { id } = await props.params;
  const [event, eventTypes] = await Promise.all([getEvent(id), listEventTypes()]);
  if (!event) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← Усі події
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-semibold">{event.title}</h1>
        <div className="flex gap-2">
          {event.status === "published" && (
            <Link href={`/events/${event.slug}`} target="_blank" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              На сайті ↗
            </Link>
          )}
          <Link href={`/admin/events/${event.id}/registrations`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Учасниці
          </Link>
        </div>
      </div>
      <EventForm
        event={{ ...event, starts_at: toKyivInput(event.starts_at), ends_at: toKyivInput(event.ends_at) }}
        eventTypes={eventTypes}
        coverUrl={coverUrl(event.cover_image_path)}
      />
    </div>
  );
}
