"use client";

import { cloneElement, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminEvent, EventType } from "@/lib/admin/data";
import { compressImage } from "@/lib/compress-image";
import { type EventFormState, saveEvent } from "../actions";

export type EventFormDefaults = Omit<AdminEvent, "starts_at" | "ends_at"> & { starts_at: string; ends_at: string };

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function EventForm({
  event,
  eventTypes,
  coverUrl,
}: {
  event?: EventFormDefaults;
  eventTypes: EventType[];
  coverUrl?: string | null;
}) {
  const [state, action, pending] = useActionState(saveEvent, {} as EventFormState);
  const [compressing, setCompressing] = useState(false);
  const err = state.errors ?? {};
  // After a failed save, refill from what was submitted; otherwise from the saved event.
  const v = (key: string, fallback: string | number | null | undefined) => state.values?.[key] ?? String(fallback ?? "");

  return (
    <form action={action} className="space-y-8">
      {event && <input type="hidden" name="id" value={event.id} />}
      <Fields
        key={state.attempt ?? 0}
        event={event}
        eventTypes={eventTypes}
        coverUrl={coverUrl}
        err={err}
        v={v}
        initialPaid={state.values ? state.values.is_paid === "on" : (event?.is_paid ?? false)}
        onCompressing={setCompressing}
      />

      {(state.message || Object.keys(err).length > 0) && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.message ?? "Перевірте поля, позначені червоним."}
        </p>
      )}
      <Button type="submit" disabled={pending || compressing} className="h-10 px-6">
        {pending ? "Зберігаємо…" : compressing ? "Готуємо фото…" : "Зберегти"}
      </Button>
    </form>
  );
}

function Fields({
  event,
  eventTypes,
  coverUrl,
  err,
  v,
  initialPaid,
  onCompressing,
}: {
  event?: EventFormDefaults;
  eventTypes: EventType[];
  coverUrl?: string | null;
  err: Record<string, string>;
  v: (key: string, fallback: string | number | null | undefined) => string;
  initialPaid: boolean;
  onCompressing: (busy: boolean) => void;
}) {
  const [isPaid, setIsPaid] = useState(initialPaid);

  // Swap the chosen photo for a smaller WebP before the form is submitted.
  async function shrinkCover(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    onCompressing(true);
    try {
      const small = await compressImage(file);
      if (small !== file) {
        const files = new DataTransfer();
        files.items.add(small);
        input.files = files.files;
      }
    } finally {
      onCompressing(false);
    }
  }

  return (
    <>
      <Fieldset title="Основне">
        <Field label="Назва" name="title" error={err.title}>
          <Input id="title" name="title" required defaultValue={v("title", event?.title)} className="h-10" />
        </Field>
        <Field label="Тип" name="event_type_id" error={err.event_type_id}>
          <select
            id="event_type_id"
            name="event_type_id"
            defaultValue={v("event_type_id", event?.event_type_id ?? eventTypes[0]?.id)}
            className={selectClass}
            onChange={(e) => !event && setIsPaid(eventTypes.find((t) => t.id === e.target.value)?.is_paid_default ?? false)}
          >
            {eventTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Опис" name="description" error={err.description} className="sm:col-span-2">
          <Textarea id="description" name="description" rows={6} defaultValue={v("description", event?.description)} />
        </Field>
        <Field
          label="Адреса сторінки"
          name="slug"
          error={err.slug}
          hint="Латиницею, напр. ranok-z-mamamy. Порожнє — створиться з назви."
          className="sm:col-span-2"
        >
          <Input id="slug" name="slug" defaultValue={v("slug", event?.slug)} placeholder="ranok-z-mamamy" className="h-10" />
        </Field>
      </Fieldset>

      <Fieldset title="Коли й де">
        <Field label="Початок (за Києвом)" name="starts_at" error={err.starts_at}>
          <Input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={v("starts_at", event?.starts_at)} className="h-10" />
        </Field>
        <Field label="Кінець (необов'язково)" name="ends_at" error={err.ends_at}>
          <Input id="ends_at" name="ends_at" type="datetime-local" defaultValue={v("ends_at", event?.ends_at)} className="h-10" />
        </Field>
        <Field label="Місце" name="location" error={err.location} hint="Напр. Львів, Стрийський парк">
          <Input id="location" name="location" defaultValue={v("location", event?.location)} className="h-10" />
        </Field>
        <Field label="Онлайн-посилання" name="online_url" error={err.online_url} hint="Для онлайн-подій: Zoom, Meet…">
          <Input id="online_url" name="online_url" type="url" defaultValue={v("online_url", event?.online_url)} className="h-10" />
        </Field>
      </Fieldset>

      <Fieldset title="Місця й оплата">
        <Field label="Кількість місць" name="capacity" error={err.capacity}>
          <Input id="capacity" name="capacity" type="number" min={1} required defaultValue={v("capacity", event?.capacity ?? 10)} className="h-10" />
        </Field>
        <div className="flex items-center gap-2 self-end pb-2">
          <input
            id="is_paid"
            name="is_paid"
            type="checkbox"
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
            className="size-4 accent-primary"
          />
          <Label htmlFor="is_paid">Платна подія</Label>
        </div>
        {isPaid && (
          <>
            <Field label="Ціна, грн" name="price_uah" error={err.price_uah}>
              <Input id="price_uah" name="price_uah" inputMode="decimal" defaultValue={v("price_uah", event?.price_uah)} className="h-10" />
            </Field>
            <Field
              label="Як оплатити"
              name="payment_instructions"
              error={err.payment_instructions}
              hint="Побачать після реєстрації: номер картки, IBAN, отримувач…"
              className="sm:col-span-2"
            >
              <Textarea id="payment_instructions" name="payment_instructions" rows={3} defaultValue={v("payment_instructions", event?.payment_instructions)} />
            </Field>
          </>
        )}
      </Fieldset>

      <Fieldset title="Обкладинка">
        {coverUrl && (
          <div className="space-y-2 sm:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a Storage URL */}
            <img src={coverUrl} alt="" className="h-40 rounded-lg object-cover" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="remove_cover" className="size-4 accent-primary" />
              Прибрати обкладинку
            </label>
          </div>
        )}
        <Field label={coverUrl ? "Замінити фото" : "Фото"} name="cover" error={err.cover} hint="JPG, PNG або WebP. Великі фото зменшуються автоматично.">
          <Input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={shrinkCover} className="h-10" />
        </Field>
      </Fieldset>

      <Fieldset title="Публікація">
        <Field label="Статус" name="status" error={err.status} hint="Чернетку бачите лише ви. Скасовану приховано з сайту.">
          <select id="status" name="status" defaultValue={v("status", event?.status ?? "draft")} className={selectClass}>
            <option value="draft">Чернетка</option>
            <option value="published">Опубліковано</option>
            <option value="cancelled">Скасовано</option>
          </select>
        </Field>
      </Fieldset>

    </>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border bg-card p-5">
      <legend className="px-1 text-sm font-medium text-muted-foreground">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactElement<React.AriaAttributes>;
}) {
  // Link the message to the control so screen readers announce it, and flag the control as invalid.
  const messageId = error || hint ? `${name}-message` : undefined;
  const control = cloneElement(children, { "aria-invalid": error ? true : undefined, "aria-describedby": messageId });
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      {control}
      {error ? (
        <p id={messageId} className="text-sm text-destructive">{error}</p>
      ) : (
        hint && <p id={messageId} className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
