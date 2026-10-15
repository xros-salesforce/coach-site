import Image from "next/image";
import Link from "next/link";
import { nav, site } from "@/content/site";
import { MobileMenu } from "./mobile-menu";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3 font-heading text-2xl font-semibold tracking-tight">
          <Image
            src="/images/logo.jpg"
            alt="" // decorative: the visible name next to it already labels the link
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
        <MobileMenu items={nav} />
      </div>
    </header>
  );
}
