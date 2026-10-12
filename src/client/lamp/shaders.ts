// GLSL for the lamp. Kept as strings so Vite needs no shader plugin.
// MAX_BLOBS here must match LAMP.MAX_BLOBS.

export const VERTEX = /* glsl */ `#version 300 es
void main() {
  // Fullscreen triangle from gl_VertexID; no buffers needed.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

#define MAX_BLOBS 16

uniform vec2 u_res;        // canvas size in pixels
uniform float u_ppu;       // pixels per short-edge unit
uniform float u_time;
uniform vec4 u_blobs[MAX_BLOBS]; // x, y, radius, temperature (units, y up)
uniform int u_count;
uniform float u_freeze;    // 0 = warm, 1 = frozen
uniform float u_glow;      // success warmth, 0..1
uniform float u_dim;       // failure / covered camera, 0..1
uniform float u_grain;

out vec4 outColor;

const vec3 VOID_C   = vec3(0.020, 0.012, 0.047); // #05030C
const vec3 NAVY     = vec3(0.051, 0.031, 0.149); // #0D0826
const vec3 MAGENTA  = vec3(1.000, 0.169, 0.839); // #FF2BD6
const vec3 VIOLET   = vec3(0.482, 0.173, 1.000); // #7B2CFF
const vec3 BLUE     = vec3(0.184, 0.357, 1.000); // #2F5BFF
const vec3 CORAL    = vec3(1.000, 0.353, 0.431); // #FF5A6E
const vec3 EMBER    = vec3(1.000, 0.416, 0.122); // #FF6A1F
const vec3 ICE      = vec3(0.624, 0.906, 1.000); // #9FE7FF

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 tempColor(float t) {
  vec3 c = t < 0.5 ? mix(BLUE, VIOLET, t * 2.0) : mix(VIOLET, MAGENTA, (t - 0.5) * 2.0);
  return mix(c, CORAL, smoothstep(0.82, 1.0, t) * 0.55);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / u_res;
  vec2 p = frag / u_ppu;

  // Metaball field, its gradient, and a field-weighted temperature.
  float field = 0.0;
  vec2 grad = vec2(0.0);
  float tempSum = 0.0;
  for (int i = 0; i < MAX_BLOBS; i++) {
    if (i >= u_count) break;
    vec4 b = u_blobs[i];
    vec2 d = p - b.xy;
    float d2 = dot(d, d) + 1e-5;
    float r2 = b.z * b.z;
    float f = r2 / d2;
    field += f;
    grad += -2.0 * r2 * d / (d2 * d2);
    tempSum += f * b.w;
  }
  float temp = tempSum / max(field, 1e-5);
  vec3 base = tempColor(temp);

  // Background: deep navy at the bottom fading to void, heater glow, faint streaks.
  vec3 bg = mix(NAVY, VOID_C, smoothstep(0.0, 0.75, uv.y));
  bg += EMBER * 0.07 * (1.0 - smoothstep(0.0, 0.28, uv.y)) * (1.0 - u_freeze) * (1.0 + u_glow);
  float col = floor(uv.x * 70.0);
  float streak = pow(hash(vec2(col, 7.0)), 10.0);
  streak *= 0.5 + 0.5 * sin(uv.y * 2.5 - u_time * 0.15 + col * 1.7);
  bg += mix(VIOLET, MAGENTA, uv.y) * streak * 0.07;

  // Blob surface: pseudo-normal from the field gradient.
  float aa = 0.06;
  float inside = smoothstep(1.0 - aa, 1.0 + aa, field);
  vec3 n = normalize(vec3(-grad / (field * 14.0), 1.0));
  float core = smoothstep(1.0, 5.0, field);
  vec3 surf = base * (0.5 + 0.55 * core);           // lit from within
  surf += base * max(0.0, -n.y) * 0.35;              // underlight from the heater
  surf += base * pow(1.0 - n.z, 2.0) * 0.3;          // rim
  vec3 H = normalize(normalize(vec3(-0.45, 0.6, 0.85)) + vec3(0.0, 0.0, 1.0));
  surf += vec3(1.0, 0.93, 1.0) * pow(max(dot(n, H), 0.0), 60.0) * 0.6; // gloss, top-left

  // Soft halo just outside blobs stands in for bloom (real bloom pass: Phase 8).
  float halo = smoothstep(0.3, 1.0, field) * (1.0 - inside);
  vec3 color = bg + base * halo * 0.32 * (1.0 + u_glow);
  color = mix(color, surf * (1.0 + u_glow * 0.35), inside);

  // Freeze: desaturate toward ice, then frost from the edges.
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(color, mix(vec3(0.02, 0.04, 0.08), ICE, clamp(lum * 1.5, 0.0, 1.0)), u_freeze * 0.85);
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float crystals = hash(floor(frag / 3.0));
  float frost = (1.0 - smoothstep(0.0, 0.2 * u_freeze + 1e-4, edge - crystals * 0.05)) * u_freeze;
  color = mix(color, ICE * 0.75, frost * 0.55);

  color *= 1.0 - u_dim * 0.6;
  color *= mix(1.0, 0.72, smoothstep(0.35, 1.0, length(uv - 0.5) * 1.35)); // vignette

  // Animated grain: kills banding, and it's a project about noise.
  color += (hash(frag + fract(u_time * 7.13) * 100.0) - 0.5) * u_grain;

  outColor = vec4(color, 1.0);
}`;
