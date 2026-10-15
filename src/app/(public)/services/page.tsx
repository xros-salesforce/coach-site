import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Section, SectionTitle } from "@/components/site/section";
import { isPlaceholder, services } from "@/content/site";

export const metadata: Metadata = { title: "Послуги" };

export default function ServicesPage() {
  return (
    <Section>
      <SectionTitle as="h1" title="Послуги" subtitle="Оберіть формат, який підходить саме вам. Не впевнені? Напишіть — підберемо разом." />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <Card key={s.title} className="flex flex-col">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 text-muted-foreground">{s.text}</CardContent>
            <CardFooter className="font-medium text-primary">{isPlaceholder(s.price) ? "Ціна за запитом" : s.price}</CardFooter>
          </Card>
        ))}
      </div>
      <div className="mt-10">
        <Link href="/contacts" className={buttonVariants({ size: "lg" })}>
          Записатися на консультацію
        </Link>
      </div>
    </Section>
  );
}
