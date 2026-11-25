"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bookmark, FileUp, User } from "lucide-react";
import { api, type College, type ListResponse, type ResourceListItem, type User as UserType } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { Badge, Card, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResourceCard } from "@/components/resource-card";
import { timeAgo } from "@/lib/format";

interface ProfileResponse {
  data: {
    user: UserType & { collegeName?: string | null; collegeLocation?: string | null };
  };
}
interface MyResourcesResponse {
  data: { resources: (ResourceListItem & { subjectName?: string; collegeName?: string })[] };
}
interface MyBookmarksResponse {
  data: { bookmarks: (ResourceListItem & { subjectName?: string; collegeName?: string })[] };
}

function DashboardContent() {
  const { data: me } = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.get<ProfileResponse>("/users/me"),
  });
  const { data: mine, isLoading: mineLoading } = useQuery({
    queryKey: ["my-resources"],
    queryFn: () => api.get<MyResourcesResponse>("/users/me/resources"),
  });
  const { data: bookmarks } = useQuery({
    queryKey: ["my-bookmarks"],
    queryFn: () => api.get<MyBookmarksResponse>("/users/me/bookmarks"),
  });

  const user = me?.data.user;
  const resources = mine?.data.resources ?? [];
  const saved = bookmarks?.data.bookmarks ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {user?.collegeName
              ? `${user.collegeName}${user.collegeLocation ? ` · ${user.collegeLocation}` : ""}`
              : "Your academic home base."}
          </p>
        </div>
        <Link href="/upload">
          <Button>
            <FileUp className="h-4 w-4" /> Upload resource
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* My uploads */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Your uploads</h2>
            <Link href="/my-resources" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {mineLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : resources.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted">
              You haven't shared anything yet.{" "}
              <Link href="/upload" className="font-medium text-accent hover:underline">Upload your first resource</Link>.
            </Card>
          ) : (
            <div className="space-y-3">
              {resources.slice(0, 5).map((r) => (
                <ResourceCard key={r.id} resource={r as ResourceListItem} />
              ))}
            </div>
          )}
        </section>

        {/* Bookmarks */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Saved resources</h2>
            <Link href="/bookmarks" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {saved.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted">
              <Bookmark className="mx-auto mb-2 h-5 w-5 text-muted/50" />
              Save resources to find them here later.
            </Card>
          ) : (
            <div className="space-y-3">
              {saved.slice(0, 5).map((r) => (
                <ResourceCard key={r.id} resource={r as ResourceListItem} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Quick links */}
      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/explore", title: "Explore resources", desc: "Search across all colleges", icon: FileUp },
          { href: "/colleges", title: "Review colleges", desc: "See what students say", icon: User },
          { href: "/profile", title: "Your profile", desc: "Account and contributions", icon: Bookmark },
        ].map(({ href, title, desc, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="flex h-full items-start gap-3 p-4 transition-colors hover:border-accent">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-accent">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-xs text-muted">{desc}</div>
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
