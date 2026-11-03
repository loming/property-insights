import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { getServerEnv } from "@/lib/api/env";

/**
 * Which set this is: the same image serves both, so the variant is a runtime value, read only after
 * connection() so no build-time value is ever baked in (doc 02, E15).
 */
export async function VariantBadge() {
  await connection();
  const { APP_VARIANT, OTHER_VARIANT_URL } = getServerEnv();
  const ridge = APP_VARIANT === "ridge";
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant={ridge ? "default" : "secondary"} data-variant={APP_VARIANT}>
        {ridge ? "Ridge model, recommended" : "Linear regression, as briefed"}
      </Badge>
      {OTHER_VARIANT_URL && (
        <a
          className="inline-flex min-h-6 items-center text-primary underline underline-offset-4 hover:no-underline"
          href={OTHER_VARIANT_URL}
        >
          {ridge ? "Switch to the brief set" : "Compare with the Ridge set"}
        </a>
      )}
    </div>
  );
}
