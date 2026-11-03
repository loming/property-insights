import { sensitivityRequestSchema } from "@/features/market/what-if-schema";
import { postSensitivity } from "@/lib/api/market";
import { invalidRequest, problemResponse } from "@/lib/api/problem-response";

/** M-3's sensitivity line (the Ridge set draws it): one feature swept across a range in one model call. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = sensitivityRequestSchema.safeParse(body);
  if (!parsed.success) {
    return invalidRequest(body === undefined ? null : parsed.error, body === undefined ? "The body must be JSON" : undefined);
  }
  try {
    return Response.json(await postSensitivity(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return problemResponse(error);
  }
}
