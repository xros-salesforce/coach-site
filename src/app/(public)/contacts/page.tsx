import type { Metadata } from "next";
import { Camera, Mail, MapPin, Phone, Send } from "lucide-react";
import { Section, SectionTitle } from "@/components/site/section";
import { isPlaceholder, site } from "@/content/site";

export const metadata: Metadata = { title: "Контакти" };

export default function ContactsPage() {
  const { email, phone, telegram, city } = site.contacts;
  // Unfinished contact details (still «…» in site.ts) are left out rather than shown as broken links.
  const items = [
    { icon: Phone, label: phone, href: `tel:${phone.replace(/[^+\d]/g, "")}` },
    { icon: Mail, label: email, href: `mailto:${email}` },
    { icon: Send, label: "Telegram", href: telegram },
    { icon: Camera, label: `@${site.instagram.handle}`, href: site.instagram.url, external: true },
    { icon: MapPin, label: city },
  ].filter((item) => !isPlaceholder(item.label) && !isPlaceholder(item.href ?? ""));
  return (
    <Section className="max-w-3xl">
      <SectionTitle as="h1" title="Контакти" subtitle="Пишіть — відповім на всі запитання щодо тренувань, харчування та подій." />
      <ul className="space-y-4 text-lg">
        {items.map(({ icon: Icon, label, href, external }) => (
          <li key={label} className="flex items-center gap-3">
            <Icon className="size-5 text-primary" aria-hidden />
            {href ? (
              <a href={href} className="hover:underline" {...(external && { target: "_blank", rel: "noopener noreferrer" })}>
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
