import { Construction } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** A section that later phases fill in. */
export function ComingNext({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <Alert className="max-w-2xl">
        <Construction aria-hidden="true" />
        <AlertTitle>Coming next</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
      </Alert>
    </div>
  );
}
