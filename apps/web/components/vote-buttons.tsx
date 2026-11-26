"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "./toast";

interface VoteTarget {
  id: string;
  userVote?: "upvote" | "downvote" | null;
  score: number;
  upvotes?: number;
  downvotes?: number;
}

/**
 * Reddit-style vote control. POST same vote toggles it off (matches API).
 */
export function VoteButtons({
  kind,
  target,
  queryKeys,
  size = "md",
  orientation = "vertical",
}: {
  kind: "resource" | "review";
  target: VoteTarget;
  queryKeys?: unknown[][];
  size?: "sm" | "md";
  orientation?: "vertical" | "horizontal";
}) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const [localVote, setLocalVote] = useState(target.userVote ?? null);
  const [localScore, setLocalScore] = useState(target.score);

  useEffect(() => {
    setLocalVote(target.userVote ?? null);
    setLocalScore(target.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id, target.userVote, target.score]);

  const basePath =
    kind === "resource" ? `/resources/${target.id}` : `/reviews/${target.id}`;

  const mutation = useMutation({
    mutationFn: async (vote: "upvote" | "downvote" | null) => {
      if (vote === null) {
        return api.delete<{ data: { userVote: null; score: number } }>(
          `${basePath}/vote`,
        );
      }
      return api.post<{ data: { userVote: string | null; score: number } }>(
        `${basePath}/vote`,
        { vote_type: vote },
      );
    },
    onMutate: async (vote) => {
      // Optimistic update.
      const current = localVote;
      let next: "upvote" | "downvote" | null = vote;
      if (vote === current) next = null; // toggle off
      setLocalVote(next);
      setLocalScore((s) => {
        const delta =
          (next === "upvote" ? 1 : next === "downvote" ? -1 : 0) -
          (current === "upvote" ? 1 : current === "downvote" ? -1 : 0);
        return s + delta;
      });
      return { prev: current };
    },
    onSuccess: (res) => {
      const d = res.data;
      setLocalVote((d.userVote as "upvote" | "downvote" | null) ?? null);
      if (typeof d.score === "number") setLocalScore(d.score);
    },
    onError: (_e, _v, ctx) => {
      setLocalVote(ctx?.prev ?? null);
      qc.invalidateQueries();
    },
    onSettled: () => {
      if (queryKeys) queryKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });

  const btn =
    size === "sm"
      ? "h-7 w-7"
      : "h-9 w-9";

  const handle = (vote: "upvote" | "downvote") => {
    if (!isAuthenticated) {
      toast("Please sign in or sign up first");
      setTimeout(() => router.push("/auth/sign-in"), 600);
      return;
    }
    if (mutation.isPending) return;
    // If clicking the active vote, send DELETE-equivalent by POSTing same
    // type (API toggles) — but our onMutate already computed toggle; we send
    // the *desired stored* vote: if currently active same type → send same
    // type which API toggles off. Simpler: send the vote type clicked.
    mutation.mutate(vote);
  };

  return (
    <div
      className={clsx(
        "flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5",
        orientation === "horizontal" && "flex-row",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Upvote"
        onClick={() => handle("upvote")}
        className={clsx(
          btn,
          "flex items-center justify-center rounded transition-colors",
          localVote === "upvote"
            ? "text-accent"
            : "text-muted hover:bg-white hover:text-foreground",
        )}
      >
        <ArrowBigUp className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} fill={localVote === "upvote" ? "currentColor" : "none"} />
      </button>
      <span
        className={clsx(
          "min-w-6 text-center text-sm font-semibold tabular-nums",
          localScore > 0 && "text-accent",
          localScore < 0 && "text-danger",
        )}
      >
        {localScore}
      </span>
      <button
        type="button"
        aria-label="Downvote"
        onClick={() => handle("downvote")}
        className={clsx(
          btn,
          "flex items-center justify-center rounded transition-colors",
          localVote === "downvote"
            ? "text-danger"
            : "text-muted hover:bg-white hover:text-foreground",
        )}
      >
        <ArrowBigDown className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} fill={localVote === "downvote" ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
