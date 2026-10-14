import type { Metadata } from "next";
import { Section } from "@/components/site/section";
import { about } from "@/content/site";

export const metadata: Metadata = { title: "Про мене" };

export default function AboutPage() {
  return (
    <Section className="max-w-3xl">
      <h1 className="mb-8 font-heading text-4xl font-semibold md:text-5xl">{about.title}</h1>
      <div className="space-y-4 text-lg leading-relaxed">
        {about.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <dl className="mt-12 grid grid-cols-3 gap-4 text-center">
        {about.highlights.map((h) => (
          <div key={h.label} className="rounded-xl bg-accent/50 p-4">
            <dt className="text-sm text-muted-foreground">{h.label}</dt>
            <dd className="order-first font-heading text-3xl font-semibold text-primary">{h.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
