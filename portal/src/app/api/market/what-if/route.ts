import { whatIfRequestSchema } from "@/features/market/what-if-schema";
import { postWhatIf } from "@/lib/api/market";
import { invalidRequest, problemResponse } from "@/lib/api/problem-response";

/** M-3: the what-if panel's calls, checked here and passed to market-api (one model call, cached there). */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = whatIfRequestSchema.safeParse(body);
  if (!parsed.success) {
    return invalidRequest(body === undefined ? null : parsed.error, body === undefined ? "The body must be JSON" : undefined);
  }
  try {
    return Response.json(await postWhatIf(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return problemResponse(error);
  }
}
