import Link from "next/link";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ComingSoonPage({
  title,
  tagline,
  description,
  bullets,
  icon: Icon,
}: {
  title: string;
  tagline: string;
  description: string;
  bullets: string[];
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-accent">
        <Icon className="h-7 w-7" />
      </div>
      <Badge tone="accent" className="mt-5">Coming soon</Badge>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-lg text-muted">{tagline}</p>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">
        {description}
      </p>
      <Card className="mx-auto mt-8 max-w-lg p-6 text-left">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          What to expect
        </h2>
        <ul className="mt-3 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-foreground">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {b}
            </li>
          ))}
        </ul>
      </Card>
      <div className="mt-8">
        <Link href="/explore">
          <Button variant="outline">Explore resources in the meantime</Button>
        </Link>
      </div>
    </div>
  );
}
