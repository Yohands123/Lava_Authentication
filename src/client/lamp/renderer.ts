import { LAMP, STIR } from "./constants";
import { FRAGMENT, VERTEX } from "./shaders";
import type { Blob } from "./physics";

export interface FrameState {
  time: number;
  freeze: number;
  glow: number;
  dim: number;
  /** Entropy ring the wax stays out of, and how strongly (0..1). */
  ring: { cx: number; cy: number; radius: number };
  ringAmount: number;
  /** Wax already pushed out of the ring; only its field is faded at the ring's edge. */
  isOut: (b: Blob) => boolean;
}

export class LampRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly u: Record<string, WebGLUniformLocation | null> = {};
  private readonly blobData = new Float32Array(LAMP.MAX_BLOBS * 4);
  private scale: number;
  /** Pixels per short-edge unit (canvas pixels). */
  ppu = 1;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error("WebGL 2 unavailable");
    this.canvas = canvas;
    this.gl = gl;
    this.program = this.link(VERTEX, FRAGMENT);
    for (const name of ["u_res", "u_ppu", "u_time", "u_blobs", "u_count", "u_freeze", "u_glow", "u_dim", "u_grain", "u_ring", "u_ringMask"]) {
      this.u[name] = gl.getUniformLocation(this.program, name);
    }
    this.scale = isMobile() ? LAMP.RESOLUTION_SCALE_MOBILE : LAMP.RESOLUTION_SCALE;
    this.resize();
  }

  /** Size of the world in short-edge units. */
  get worldSize(): { width: number; height: number } {
    return { width: this.canvas.width / this.ppu, height: this.canvas.height / this.ppu };
  }

  get resolutionScale(): number {
    return this.scale;
  }

  setResolutionScale(scale: number): void {
    this.scale = Math.max(LAMP.RESOLUTION_SCALE_MIN, Math.min(1, scale));
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(window.innerWidth * dpr * this.scale));
    const h = Math.max(1, Math.round(window.innerHeight * dpr * this.scale));
    this.canvas.width = w;
    this.canvas.height = h;
    this.ppu = Math.min(w, h);
    this.gl.viewport(0, 0, w, h);
  }

  /** Convert a client (CSS pixel) position to world units, y up. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const sx = this.canvas.width / window.innerWidth;
    const sy = this.canvas.height / window.innerHeight;
    return { x: (clientX * sx) / this.ppu, y: ((window.innerHeight - clientY) * sy) / this.ppu };
  }

  render(blobs: readonly Blob[], state: FrameState): void {
    const gl = this.gl;
    const count = Math.min(blobs.length, LAMP.MAX_BLOBS);
    for (let i = 0; i < count; i++) {
      const b = blobs[i]!;
      // Temperature is 0..1; +2 flags wax that is out of the ring (decoded in the shader).
      this.blobData.set([b.x, b.y, b.r, b.t + (state.isOut(b) ? 2 : 0)], i * 4);
    }
    gl.useProgram(this.program);
    gl.uniform2f(this.u.u_res!, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.u_ppu!, this.ppu);
    gl.uniform1f(this.u.u_time!, state.time);
    gl.uniform4fv(this.u.u_blobs!, this.blobData);
    gl.uniform1i(this.u.u_count!, count);
    gl.uniform1f(this.u.u_freeze!, state.freeze);
    gl.uniform1f(this.u.u_glow!, state.glow);
    gl.uniform1f(this.u.u_dim!, state.dim);
    gl.uniform1f(this.u.u_grain!, LAMP.GRAIN);
    gl.uniform3f(this.u.u_ring!, state.ring.cx, state.ring.cy, state.ring.radius);
    gl.uniform2f(this.u.u_ringMask!, state.ringAmount, STIR.RING_SOFT_EDGE);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Read a 64×64 block from the centre. Call right after render(). */
  readCentre(): Uint8Array {
    const size = 64;
    const out = new Uint8Array(size * size * 4);
    const x = Math.max(0, Math.floor(this.canvas.width / 2 - size / 2));
    const y = Math.max(0, Math.floor(this.canvas.height / 2 - size / 2));
    this.gl.readPixels(x, y, size, size, this.gl.RGBA, this.gl.UNSIGNED_BYTE, out);
    return out;
  }

  private link(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader) ?? ""}`);
      }
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program) ?? ""}`);
    }
    return program;
  }
}

export function isMobile(): boolean {
  return window.matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 600;
}
