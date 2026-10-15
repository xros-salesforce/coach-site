import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { env } from "@/lib/env";

export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  capacity: number;
  is_paid: boolean;
  price_uah: number | null;
  cover_image_path: string | null;
  type_code: string;
  type_name: string;
  seats_left: number;
};

// Cached for about a minute; admin edits and registration changes call updateTag(EVENTS_TAG) to refresh
// seat counts sooner. The meeting link and payment instructions are deliberately not public (see the
// events_public view); participants get them by email after registering.
export const EVENTS_TAG = "events";

export async function getUpcomingEvents(limit?: number): Promise<PublicEvent[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(EVENTS_TAG);
  let query = createPublicClient()
    .from("events_public")
    .select("*")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data as PublicEvent[];
}

export async function getEventBySlug(slug: string): Promise<PublicEvent | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(EVENTS_TAG);
  const { data, error } = await createPublicClient()
    .from("events_public")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as PublicEvent | null;
}

export function coverUrl(path: string | null) {
  return path ? `${env().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-covers/${path}` : null;
}

// Public pages render a fallback instead of failing when the database is unreachable.
export async function tryGetUpcomingEvents(limit?: number) {
  try {
    return { events: await getUpcomingEvents(limit), failed: false as const };
  } catch (error) {
    console.error("Failed to load events", error);
    return { events: [] as PublicEvent[], failed: true as const };
  }
}
