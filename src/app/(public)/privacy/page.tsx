import type { Metadata } from "next";
import { Section } from "@/components/site/section";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Політика конфіденційності" };

// TODO(content): have this text reviewed; it is a starting template, not legal advice.
export default function PrivacyPage() {
  return (
    <Section className="max-w-3xl space-y-4 leading-relaxed">
      <h1 className="font-heading text-4xl font-semibold">Політика конфіденційності</h1>
      <p>
        Власник сайту — {site.name} (далі — «ми»). Ми обробляємо персональні дані відповідно до Закону України
        «Про захист персональних даних».
      </p>
      <h2 className="font-heading text-2xl font-semibold">Які дані ми збираємо</h2>
      <p>Ім&apos;я, email, телефон, нікнейм в Instagram та коментар, які ви вказуєте у формах на сайті.</p>
      <h2 className="font-heading text-2xl font-semibold">Навіщо</h2>
      <p>
        Щоб зареєструвати вас на подію, надіслати підтвердження та важливу інформацію про неї. Якщо ви дали окрему згоду —
        щоб повідомляти про майбутні події.
      </p>
      <h2 className="font-heading text-2xl font-semibold">Ваші права</h2>
      <p>
        Ви можете відкликати згоду на розсилку за посиланням у будь-якому листі, а також попросити видалити ваші дані,
        написавши на {site.contacts.email}.
      </p>
    </Section>
  );
}
