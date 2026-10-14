import type { Metadata } from "next";
import Image from "next/image";
import { Section, SectionTitle } from "@/components/site/section";
import { gallery, site } from "@/content/site";

export const metadata: Metadata = { title: "Галерея" };

export default function GalleryPage() {
  return (
    <Section>
      <SectionTitle title="Галерея" subtitle="Улюблені публікації з Instagram." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {gallery.map((item) => (
          <a
            key={item.code}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
          >
            <Image
              src={`/images/gallery/${item.code}.jpg`}
              alt={item.alt}
              fill
              sizes="(min-width: 768px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </a>
        ))}
      </div>
      <a
        href={site.instagram.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block text-primary underline-offset-4 hover:underline"
      >
        Більше в Instagram @{site.instagram.handle} →
      </a>
    </Section>
  );
}
