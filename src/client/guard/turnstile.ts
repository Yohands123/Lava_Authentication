interface Widget {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
}
declare global { interface Window { turnstile?: Widget } }
let loading: Promise<void> | null = null;
function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    const timer = window.setTimeout(() => { script.remove(); loading = null; reject(new Error("Verification unavailable")); }, 10000);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); loading = null; reject(new Error("Verification unavailable")); };
    document.head.append(script);
  });
  return loading;
}
/** Widget is created only after an explicit additional-verification action. */
export async function turnstileToken(container: HTMLElement, siteKey: string, id: string, signal: AbortSignal): Promise<string> {
  await load();
  if (signal.aborted || !window.turnstile) throw new Error("Verification cancelled");
  return new Promise((resolve, reject) => {
    const done = (token?: string) => { window.turnstile?.remove(widget); signal.removeEventListener("abort", abort); if (token) resolve(token); else reject(new Error("Verification expired or unavailable")); };
    const abort = () => done();
    const widget = window.turnstile!.render(container, { sitekey: siteKey, action: "lava_guard", cData: id, theme: "dark", size: "compact",
      callback: (token: string) => done(token), "error-callback": () => done(), "expired-callback": () => done(), "timeout-callback": () => done() });
    signal.addEventListener("abort", abort, { once: true });
  });
}
