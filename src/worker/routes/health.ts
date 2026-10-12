import { json } from "../lib/http";
import { challenges, type Env } from "../env";
import { healthReport } from "../entropy/stats";

// Powers Lab mode. Never include user identifiers or client digests here.
export async function health(_request: Request, env: Env): Promise<Response> {
  return json(healthReport(await challenges(env).stats()));
}
