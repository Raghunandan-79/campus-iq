"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, GraduationCap, LayoutDashboard, Menu, Upload, User, X } from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "@/lib/auth";
import { Button } from "./ui/button";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/colleges", label: "Colleges" },
  { href: "/subjects", label: "Subjects" },
];

const COMING_SOON = [
  { href: "/ai-study", label: "AI Study" },
  { href: "/mentorship", label: "Mentorship" },
];

export function SiteHeader() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (href: string) =>
    clsx(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      pathname === href
        ? "bg-surface text-foreground"
        : "text-muted hover:bg-surface hover:text-foreground",
    );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
            <GraduationCap className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-bold tracking-tight">CampusIQ</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={linkClass(n.href)}>
              {n.label}
            </Link>
          ))}
          {COMING_SOON.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(linkClass(n.href), "text-muted/70")}
            >
              {n.label}
              <span className="ml-1 rounded bg-surface px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Soon
              </span>
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isLoading ? null : isAuthenticated ? (
            <>
              <Link href="/upload">
                <Button size="sm" variant="outline">
                  <Upload className="h-4 w-4" /> Upload
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="sm" variant="ghost">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Button>
              </Link>
              <Link href="/profile">
                <Button size="sm" variant="ghost">
                  <User className="h-4 w-4" /> {user?.name.split(" ")[0]}
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => void logout()}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/sign-in">
                <Button size="sm" variant="ghost">Sign in</Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-md p-2 text-muted hover:bg-surface md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {[...NAV, ...COMING_SOON].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-surface"
              >
                {n.label}
                {COMING_SOON.includes(n) && (
                  <span className="ml-2 text-xs text-muted">Soon</span>
                )}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-border pt-3">
              {isAuthenticated ? (
                <>
                  <Link href="/upload" className="flex-1">
                    <Button size="sm" variant="outline" className="w-full">
                      <Upload className="h-4 w-4" /> Upload
                    </Button>
                  </Link>
                  <Link href="/dashboard" className="flex-1">
                    <Button size="sm" variant="outline" className="w-full">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => void logout()}>
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/auth/sign-in" className="flex-1">
                    <Button size="sm" variant="outline" className="w-full">Sign in</Button>
                  </Link>
                  <Link href="/auth/sign-up" className="flex-1">
                    <Button size="sm" className="w-full">Sign up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span className="font-semibold text-foreground">CampusIQ</span>
          <span>— Survive semesters. Together.</span>
        </div>
        <div className="flex gap-6">
          <Link href="/explore" className="hover:text-foreground">Explore</Link>
          <Link href="/colleges" className="hover:text-foreground">Colleges</Link>
          <Link href="/subjects" className="hover:text-foreground">Subjects</Link>
          <Link href="/upload" className="hover:text-foreground">Upload</Link>
        </div>
      </div>
    </footer>
  );
}
