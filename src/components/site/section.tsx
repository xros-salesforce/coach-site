import { cn } from "@/lib/utils";

export function Section({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("mx-auto w-full max-w-6xl px-4 py-12 md:py-16", className)} {...props} />;
}

// Use as="h1" when the title is the page's main heading (one h1 per page, for SEO and screen readers).
export function SectionTitle({ title, subtitle, as: Heading = "h2" }: { title: string; subtitle?: string; as?: "h1" | "h2" }) {
  return (
    <div className="mb-8 max-w-2xl">
      <Heading className="font-heading text-3xl font-semibold md:text-4xl">{title}</Heading>
      {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
