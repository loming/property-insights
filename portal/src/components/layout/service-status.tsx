import { CircleCheck, CircleHelp, CircleX } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { getServiceStatus, type Status } from "@/lib/api/status";

const TEXT: Record<Status, string> = { up: "Available", down: "Not responding", unknown: "Unknown" };

function StatusLine({ name, status }: { name: string; status: Status }) {
  const Icon = status === "up" ? CircleCheck : status === "down" ? CircleX : CircleHelp;
  const colour = status === "up" ? "text-success" : status === "down" ? "text-destructive" : "text-muted-foreground";
  return (
    <li className="flex items-center gap-2">
      {/* The icon repeats the text; colour is never the only signal (WCAG 1.4.1). */}
      <Icon aria-hidden="true" className={`size-4 ${colour}`} />
      <span className="font-medium">{name}:</span>
      <span>{TEXT[status]}</span>
    </li>
  );
}

/** Live status of both backends and, through estimator-api's health, of the model. */
export async function ServiceStatus() {
  const status = await getServiceStatus();
  return (
    <ul className="space-y-1 text-sm">
      <StatusLine name="Estimator service" status={status.estimator} />
      <StatusLine name="Market service" status={status.market} />
      <StatusLine name="Prediction model" status={status.model} />
    </ul>
  );
}

export function ServiceStatusSkeleton() {
  return (
    <div role="status" className="space-y-2">
      <span className="sr-only">Checking the services</span>
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-4 w-52" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}
