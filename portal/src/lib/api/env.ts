import "server-only";

import { z } from "zod";

const schema = z.object({
  ESTIMATOR_API_URL: z.url(),
  MARKET_API_URL: z.url(),
  // Which set this container serves: the brief set (plain linear regression) or the Ridge set.
  APP_VARIANT: z.enum(["brief", "ridge"]).default("brief"),
  // The other set's public URL, for the header's "switch" link.
  OTHER_VARIANT_URL: z.url().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

/**
 * Server-only runtime configuration, validated on first use rather than at import: `next build` runs
 * without these variables, and NEXT_PUBLIC_* values would be frozen into the image (doc 02, E3).
 */
export function getServerEnv(): ServerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Tests change process.env between cases. */
export function resetServerEnv(): void {
  cached = undefined;
}
