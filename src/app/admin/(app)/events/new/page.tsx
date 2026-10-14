import type { Metadata } from "next";
import Link from "next/link";
import { listEventTypes } from "@/lib/admin/data";
import { EventForm } from "../event-form";

// Admin data is always fetched fresh, so navigation waits for it; instant navigation isn't a goal here.
export const instant = false;

export const metadata: Metadata = { title: "Нова подія" };

export default async function NewEventPage() {
  const eventTypes = await listEventTypes();
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← Усі події
      </Link>
      <h1 className="font-heading text-3xl font-semibold">Нова подія</h1>
      <EventForm eventTypes={eventTypes} />
    </div>
  );
}
