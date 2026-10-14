import Image from "next/image";
import { cn } from "@/lib/utils";

// Dark photo banner used at the top of the home and About pages.
// Photo: "Kurzhanteln 2 x 15 kg" by Singlespeedfahrer, Wikimedia Commons, CC0 (no attribution required).
export function PageHero({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.2_0.03_40)] text-white">
      <Image
        src="/images/hero-dumbbells.jpg"
        alt=""
        fill
        sizes="100vw"
        loading="eager"
        fetchPriority="high"
        className="-z-20 object-cover object-[70%_center]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[oklch(0.2_0.03_40/0.92)] via-[oklch(0.2_0.03_40/0.75)] to-[oklch(0.25_0.05_35/0.45)]" />
      <div className={cn("mx-auto flex max-w-6xl flex-col gap-6 px-4", className)}>{children}</div>
    </section>
  );
}

export function PageHeroEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium uppercase tracking-widest text-[oklch(0.78_0.1_40)]">{children}</p>;
}
