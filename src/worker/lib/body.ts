/** Size and wall-time bounds apply even to chunked/lying streaming clients. */
export async function boundedBody(request: Request, allowed: readonly string[], maxBytes = 32768): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) return null;
  if (Number(request.headers.get("Content-Length")) > maxBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = []; let length = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("body_timeout")), 3000); });
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) return null;
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let at = 0;
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some(k => !allowed.includes(k))) return null;
    return data as Record<string, unknown>;
  } catch { return null; }
  finally { if (timer !== undefined) clearTimeout(timer); void reader.cancel().catch(() => {}); }
}
