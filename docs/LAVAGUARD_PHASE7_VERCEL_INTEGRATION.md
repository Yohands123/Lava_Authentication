# Vercel and Cloudflare integration assessment

Read-only connected Vercel project lookup filtered by `https://github.com/Yohands123/Lava_Authentication` returned zero projects on October 19, 2026 in the available account scope. No project was created, linked or deployed. The existing public URL is the Cloudflare Worker demo, not Vercel. GitHub publication and hosting deployment remain separate.

The Vercel backend architecture skill was used for this assessment. Source inspection shows Vite assets plus Worker `/api` handlers, Durable Object bindings, exact ORIGIN/RP-ID checks and host-only secure session cookies. This backend cannot simply be uploaded as unchanged Vercel Functions. Vercel documents [external rewrites](https://vercel.com/docs/routing/rewrites) as a reverse-proxy capability; that capability alone does not validate LavaAuth's identity, state or ingress integration.

## Option A — keep authentication on the existing Worker

Prefer this initial architecture if a separate Vercel presence is wanted: keep the complete authenticated application and its existing relying party on Cloudflare; Vercel may host clearly labeled documentation/marketing with a link to that application. A separate static site must not display a working-looking login backed by missing APIs. No extra site was published here. Proposed project name is `lavaauth-docs` (not created); domain, Git linkage/root, documentation build and output require an owner-selected documentation source before provisioning. No URL is invented.

## Option B — same-origin frontend/API proxy

The local engineering analogue is implemented and browser-tested: browser origin `http://localhost:8812` → bounded proxy → frozen Worker at port 8810 → actual DO state → verified WebAuthn → strict cookie/session → revocation. It preserves real Origin rather than trusting a client-supplied forwarded-origin claim. Keyboard/no-WebGL login with positive WebDriver succeeds using a virtual authenticator; missing credentials and replay fail. This is **not a Vercel deployment test** or a physical authenticator test.

Proposed project `lavaauth-frontend` is not created. Proposed Git production branch is `main`, build command `npm run build`, output `dist`, and framework Vite. The intended deployment/custom domain and backend origin are **not selected**. Draft route `/api/:path*` must preserve `/api/` at the owner-approved Worker backend, forward Origin/cookies correctly, avoid caching auth/options/session responses, and reject untrusted proxy-origin headers. Do not commit a root deployment configuration that silently activates a project or exposes secrets.

The backend must use the exact reviewed public ORIGIN and RP_ID, independent WebAuthn challenge/signature/UV/counter verification, one-use challenge/clearance ownership and unchanged strict cookie flags. Any trusted proxy credential stays server-only. Validate CSRF, direct-backend restrictions, rate attribution, ingress size/deadline, cancellation, TLS and session revocation through the actual chosen serving path. Do not weaken CORS, accept arbitrary forwarded Origin, or add broad relying-party wildcards.

An existing passkey scoped to `workers.dev` does not automatically transfer to a new custom relying party. Domain/RP changes require an explicit user/credential transition plan and disposable staging state before touching real accounts. Existing session cookies likewise belong to their host. No credentials or customer data were copied, and no production bindings/origin/RP values changed.

Before any preview: owner approves account/project/Git source/domain/budget, disables unintended automatic production deployment, selects the backend route, tests a real authenticator and disposable accounts, verifies cookie/CSRF/replay/revocation on that exact hostname, and records rollback plus deployed artifact SHA. Vercel preview, functional sign-in on Vercel and Cloudflare backend deployment are all **NOT DONE/NOT TESTED**. Current authorization explicitly excludes deployment, creation of hosting resources, spending and merge. The local proxy does not waive those gates.
