import type { Metadata } from "next";
import { Section, SectionTitle } from "@/components/site/section";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Галерея" };

export default function GalleryPage() {
  return (
    <Section>
      <SectionTitle title="Галерея" subtitle="Свіжі публікації з Instagram." />
      {/* Instagram feed arrives in phase 6. */}
      <a href={site.instagram.url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
        Підписатися на @{site.instagram.handle}
      </a>
    </Section>
  );
}
