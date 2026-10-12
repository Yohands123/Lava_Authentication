import { json } from "../lib/http";
import { challenges, type Env } from "../env";

// Powers Lab mode. Never include user identifiers or client digests here.
export async function health(_request: Request, env: Env): Promise<Response> {
  const stats = await challenges(env).stats();
  return json({
    secureGenerator: "ok",
    challenges: stats,
  });
}
