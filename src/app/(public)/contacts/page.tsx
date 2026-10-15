import type { Metadata } from "next";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { Section, SectionTitle } from "@/components/site/section";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Контакти" };

export default function ContactsPage() {
  const { email, phone, telegram, city } = site.contacts;
  const items = [
    { icon: Phone, label: phone, href: `tel:${phone.replace(/[^+\d]/g, "")}` },
    { icon: Mail, label: email, href: `mailto:${email}` },
    { icon: Send, label: "Telegram", href: telegram },
    { icon: MapPin, label: city },
  ];
  return (
    <Section className="max-w-3xl">
      <SectionTitle as="h1" title="Контакти" subtitle="Пишіть — відповім на всі запитання щодо тренувань, харчування та подій." />
      <ul className="space-y-4 text-lg">
        {items.map(({ icon: Icon, label, href }) => (
          <li key={label} className="flex items-center gap-3">
            <Icon className="size-5 text-primary" />
            {href ? (
              <a href={href} className="hover:underline">
                {label}
              </a>
            ) : (
              label
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
