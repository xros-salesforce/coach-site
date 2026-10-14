import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { nav, site } from "@/content/site";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3 font-heading text-2xl font-semibold tracking-tight">
          <Image
            src="/images/logo.jpg"
            alt={site.name}
            width={40}
            height={40}
            loading="eager"
            className="size-10 rounded-full object-cover ring-2 ring-primary/20"
          />
          {site.shortName}
        </Link>
        <nav className="hidden gap-6 text-sm md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        {/* Mobile menu without client JS. */}
        <details className="group relative md:hidden">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md hover:bg-muted" aria-label="Меню">
            <Menu className="size-5" />
          </summary>
          <nav className="absolute right-0 mt-2 flex w-48 flex-col rounded-lg border bg-card p-2 shadow-lg">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm hover:bg-muted">
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
