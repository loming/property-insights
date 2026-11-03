import { Card, CardContent } from "@/components/ui/card";

/** A labelled figure; the label is the term and the value its description, for screen readers too. */
export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <dl>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">{value}</dd>
          {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
        </dl>
      </CardContent>
    </Card>
  );
}
