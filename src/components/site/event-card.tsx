import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicEvent } from "@/lib/events";
import { formatDate, formatPrice, formatTimeRange, pluralSeats } from "@/lib/format";

export function EventCard({ event }: { event: PublicEvent }) {
  const full = event.seats_left <= 0;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{event.type_name}</Badge>
          <Badge variant={event.is_paid ? "outline" : "default"}>{formatPrice(event.price_uah)}</Badge>
        </div>
        <CardTitle className="font-heading text-2xl">
          <Link href={`/events/${event.slug}`} className="after:absolute after:inset-0">
            {event.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0" />
          <span>
            <span className="inline-block first-letter:uppercase">{formatDate(event.starts_at)}</span>, {formatTimeRange(event.starts_at, event.ends_at)}
          </span>
        </p>
        {event.location && (
          <p className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" />
            {event.location}
          </p>
        )}
      </CardContent>
      <CardFooter className="text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Users className="size-4" />
          {full ? "Місць немає — лист очікування" : `Залишилось ${pluralSeats(event.seats_left)}`}
        </span>
      </CardFooter>
    </Card>
  );
}

export function EventGrid({ events }: { events: PublicEvent[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <div key={e.id} className="relative">
          <EventCard event={e} />
        </div>
      ))}
    </div>
  );
}
