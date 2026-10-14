import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: { default: "Адмінка", template: "%s | Адмінка" },
  robots: { index: false, follow: false },
};

const nav = [
  { href: "/admin", label: "Події" },
  { href: "/admin/contacts", label: "Контакти" },
];

// The chrome is static and prerenders; the session-dependent parts stream in behind Suspense.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/admin" className="font-heading text-xl font-semibold">
            Адмінка
          </Link>
          <nav className="flex gap-4 text-sm">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
              На сайт ↗
            </Link>
            <Suspense>
              <SignedInAs />
            </Suspense>
          </div>
        </div>
      </header>
      {/* loading.tsx wraps the page in Suspense, so every navigation shows a placeholder at once. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

async function SignedInAs() {
  const admin = await requireAdmin();
  return (
    <form action={signOut} className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground md:inline">{admin.email}</span>
      <Button type="submit" variant="ghost" size="sm" aria-label="Вийти">
        <LogOut />
        Вийти
      </Button>
    </form>
  );
}
