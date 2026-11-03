import { connection } from "next/server";

import { getServerEnv } from "@/lib/api/env";

/**
 * Liveness for Docker. It validates the runtime configuration, so a misconfigured container fails its
 * healthcheck straight away instead of on the first page (doc 02, E3).
 */
export async function GET() {
  await connection();
  try {
    const { APP_VARIANT } = getServerEnv();
    return Response.json({ status: "ok", variant: APP_VARIANT });
  } catch (error) {
    console.error(error);
    return Response.json({ status: "misconfigured" }, { status: 500 });
  }
}
