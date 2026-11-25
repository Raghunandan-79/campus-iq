"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Building2, Search, Upload } from "lucide-react";
import { api, RESOURCE_TYPE_LABELS, type ListResponse, type ResourceListItem, type Subject } from "@/lib/api";
import { Badge, Card, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResourceCard } from "@/components/resource-card";

function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : "/explore");
      }}
      className="mx-auto mt-8 flex w-full max-w-xl"
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes, PYQs, subjects…"
          className="h-12 w-full rounded-l-md border border-r-0 border-border bg-white pl-10 pr-4 text-[15px] text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <Button type="submit" size="lg" className="rounded-l-none px-6">
        Search
      </Button>
    </form>
  );
}

function RecentResources() {
  const { data, isLoading } = useQuery({
    queryKey: ["resources", "recent"],
    queryFn: () =>
      api.get<ListResponse<ResourceListItem>>("/resources?pageSize=6&sort=newest"),
  });
  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  const items = data?.data ?? [];
  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted">
        No resources yet. Be the first to share your notes.
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {items.map((r) => (
        <ResourceCard key={r.id} resource={r} />
      ))}
    </div>
  );
}

function PopularSubjects() {
  const { data, isLoading } = useQuery({
    queryKey: ["subjects", "landing"],
    queryFn: () => api.get<ListResponse<Subject>>("/subjects?pageSize=8"),
  });
  const items = data?.data ?? [];
  if (isLoading || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 8).map((s) => (
        <Link
          key={s.id}
          href={`/subjects/${s.id}`}
          className="rounded-full border border-border bg-white px-3.5 py-1.5 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          {s.name}
          {s.semester ? <span className="ml-1 text-xs text-muted">Sem {s.semester}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="border-b border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center">
          <Badge tone="accent" className="mb-5">Cross-campus academic network</Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Your campus knowledge, all in one place.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            Discover notes, previous-year questions, and study resources shared by
            students across colleges.
          </p>
          <HeroSearch />
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/explore">
              <Button variant="outline" size="lg">
                Explore resources <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/upload">
              <Button size="lg">
                <Upload className="h-4 w-4" /> Share a resource
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Resource categories */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-xl font-bold tracking-tight">What students share</h2>
        <p className="mt-1 text-sm text-muted">
          Structured, searchable academic material — not scattered drive links.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(RESOURCE_TYPE_LABELS).map(([key, label]) => (
            <Link
              key={key}
              href={`/explore?resourceType=${key}`}
              className="rounded-lg border border-border bg-white p-4 text-center transition-colors hover:border-accent"
            >
              <div className="text-sm font-semibold text-foreground">{label}</div>
              <div className="mt-1 text-xs text-muted">
                {key === "pyq" ? "Previous year questions" : key === "notes" ? "Class notes & summaries" : "Study material"}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recently added */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Recently added</h2>
              <p className="mt-1 text-sm text-muted">
                Fresh material from students across CampusIQ.
              </p>
            </div>
            <Link href="/explore" className="text-sm font-medium text-accent hover:underline">
              View all →
            </Link>
          </div>
          <RecentResources />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-xl font-bold tracking-tight">How CampusIQ works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: BookOpen,
              title: "Discover",
              body: "Search notes, PYQs, syllabi and solved papers shared by students from any college — not just your own.",
            },
            {
              icon: Upload,
              title: "Contribute",
              body: "Upload PDFs you found useful. Every upload is attributed to you and your college.",
            },
            {
              icon: Building2,
              title: "Decide",
              body: "Upvote, review, and discuss resources. Rate colleges based on real student experience.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-accent">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Cross-campus + subjects */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Built for cross-campus sharing</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                A DBMS paper from NIT Trichy can help a first-year at VIT. CampusIQ
                treats academic knowledge as a shared resource: resources are visible
                campus-wide by default, attributed to their source college, and
                moderated by the community — not locked inside WhatsApp groups or
                scattered Drive folders.
              </p>
              <Link href="/explore" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                Browse the network <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Popular subjects</h2>
              <div className="mt-4">
                <PopularSubjects />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Coming soon */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-xl font-bold tracking-tight">On the roadmap</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { title: "AI Study", body: "Personalized study plans, smart summaries, and practice questions generated from shared resources.", href: "/ai-study" },
            { title: "Mentorship", body: "Connect with seniors and peers for guidance on academics, placements, and campus life.", href: "/mentorship" },
          ].map((f) => (
            <Link key={f.title} href={f.href}>
              <Card className="flex h-full flex-col p-5 transition-colors hover:border-accent">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{f.title}</h3>
                  <Badge>Coming soon</Badge>
                </div>
                <p className="mt-2 flex-1 text-sm text-muted">{f.body}</p>
                <span className="mt-3 text-sm font-medium text-accent">Learn more →</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
