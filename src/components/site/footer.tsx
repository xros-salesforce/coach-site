import Link from "next/link";
import { cacheLife } from "next/cache";
import { site } from "@/content/site";

// Cached so the footer stays prerenderable; refreshes daily to roll over at New Year.
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>© <CopyrightYear /> {site.name}</p>
        <div className="flex flex-wrap gap-4">
          <a href={site.instagram.url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
            Instagram
          </a>
          <Link href="/privacy" className="hover:text-foreground">
            Політика конфіденційності
          </Link>
        </div>
      </div>
    </footer>
  );
}
