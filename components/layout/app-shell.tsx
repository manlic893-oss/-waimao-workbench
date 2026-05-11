"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/layout/logout-button";

const navigation = [
  { href: "/dashboard", label: "看板" },
  { href: "/customers", label: "客户管理" },
  { href: "/tasks", label: "每日清单" },
];

export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
              外
            </div>
            <div>
              <p className="text-sm font-semibold">外贸工作台</p>
              <p className="text-xs text-muted-foreground">双人团队实时协作</p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  pathname === item.href ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{formatDate(new Date())}</p>
              <p className="text-sm font-medium text-foreground">{userEmail}</p>
            </div>
            <LogoutButton />
          </div>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((value) => !value)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {open ? (
          <div className="border-t bg-white md:hidden">
            <div className="container space-y-3 py-4">
              <div className="space-y-2">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block rounded-2xl px-4 py-3 text-sm font-medium",
                      pathname === item.href ? "bg-primary text-primary-foreground" : "bg-secondary/70 text-foreground",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-xs text-muted-foreground">{formatDate(new Date())}</p>
                <p className="mt-1 text-sm font-medium">{userEmail}</p>
                <div className="mt-3">
                  <LogoutButton />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="container py-6">{children}</main>
    </div>
  );
}
