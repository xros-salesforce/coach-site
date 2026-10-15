"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";

// Phone menu. Lives in the persistent layout, so it must close itself on navigation (otherwise the
// open dropdown keeps covering the next page): on link taps, browser back/forward, and taps outside.
// (usePathname would also work but forces a Suspense boundary for prerendered dynamic routes.)
export function MobileMenu({ items }: { items: readonly { href: string; label: string }[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("popstate", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("popstate", close);
    };
  }, []);

  return (
    <details ref={menu} className="group relative md:hidden">
      <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md hover:bg-muted" aria-label="Меню">
        <Menu className="size-5" />
      </summary>
      <nav className="absolute right-0 mt-2 flex w-48 flex-col rounded-lg border bg-card p-2 shadow-lg">
        {items.map((item) => (
          <Link key={item.href} href={item.href} onClick={close} className="rounded-md px-3 py-2 text-sm hover:bg-muted">
            {item.label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
