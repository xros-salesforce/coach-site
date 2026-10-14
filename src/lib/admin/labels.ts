import type { EventStatus, RegistrationStatus } from "@/lib/admin/data";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const eventStatus: Record<EventStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Чернетка", variant: "outline" },
  published: { label: "Опубліковано", variant: "default" },
  cancelled: { label: "Скасовано", variant: "destructive" },
};

export const registrationStatus: Record<RegistrationStatus, { label: string; variant: BadgeVariant }> = {
  confirmed: { label: "Підтверджено", variant: "default" },
  pending_payment: { label: "Очікує оплати", variant: "secondary" },
  waitlist: { label: "Лист очікування", variant: "outline" },
  cancelled: { label: "Скасовано", variant: "destructive" },
  expired: { label: "Бронь минула", variant: "destructive" },
};

export const contactSource = {
  registration: "Реєстрація",
  interest_form: "Форма інтересу",
  manual: "Додано вручну",
} as const;
