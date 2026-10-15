import type { Metadata } from "next";
import Image from "next/image";
import { PageHero, PageHeroEyebrow } from "@/components/site/page-hero";
import { Section } from "@/components/site/section";
import { about, withoutPlaceholders } from "@/content/site";

export const metadata: Metadata = { title: "Про мене" };

export default function AboutPage() {
  return (
    <>
      <PageHero className="py-14 md:py-20">
        <PageHeroEyebrow>Фітнес-тренерка · Львів</PageHeroEyebrow>
        <h1 className="font-heading text-5xl font-semibold md:text-6xl">{about.title}</h1>
        <p className="max-w-2xl text-lg text-white/80">−26 кг власного досвіду · фітнес-бікіні · натуральний бодібілдинг</p>
      </PageHero>

      <Section className="grid gap-10 md:grid-cols-[1fr_320px] md:gap-14">
        <div>
          <div className="space-y-4 text-lg leading-relaxed">
            {about.paragraphs.map(withoutPlaceholders).filter(Boolean).map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <dl className="mt-12 grid gap-4 text-center sm:grid-cols-3">
            {about.highlights.map((h) => (
              <div key={h.label} className="flex flex-col rounded-xl bg-accent/50 p-4">
                <dt className="text-sm text-muted-foreground">{h.label}</dt>
                <dd className="order-first font-heading text-3xl font-semibold text-primary">{h.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="grid max-w-sm gap-4 md:max-w-none">
          {about.photos.map((photo) => (
            <figure key={photo.src} className="space-y-2">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
                <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 768px) 320px, 50vw" className="object-cover" />
              </div>
              <figcaption className="text-sm text-muted-foreground">{photo.caption}</figcaption>
            </figure>
          ))}
        </aside>
      </Section>
    </>
  );
}
