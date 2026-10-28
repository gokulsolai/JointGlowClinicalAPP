import type { Point } from '../types';
import { LM, faceCenter } from '../landmarks';
import { getMeshTriangles } from '../faceMesh';
import type { MaskCanvases } from '../masks';
import type { EffectUniforms } from '../treatments';
import { applyWarps, type WarpTool } from '../warps';
import { BLUR_FRAG, COPY_FRAG, EFFECT_FRAG, VERT } from './shaders';

const MOVABLE = 468;
const RING = LM.FACE_OVAL.length;

interface Program {
  prog: WebGLProgram;
  attribs: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export interface SceneParams {
  image: HTMLCanvasElement;
  landmarks: Point[];
  masks: MaskCanvases;
  faceWidth: number;
  skinMean: [number, number, number];
  cheekMean: [number, number, number];
  globalRedness: number;
}

/**
 * WebGL1 renderer: draws the photo through the treatment shader and overlays the face mesh,
 * whose vertices can be displaced to simulate filler volume changes.
 */
export class FaceRenderer {
  private gl: WebGLRenderingContext;
  private effect: Program;
  private blur: Program;
  private copy: Program;
  private quadPos: WebGLBuffer;
  private quadUv: WebGLBuffer;
  private meshPos: WebGLBuffer;
  private meshUv: WebGLBuffer;
  private meshIdx: WebGLBuffer;
  private indexCount = 0;
  private W = 1;
  private H = 1;
  private basePos = new Float32Array(0);
  private curPos = new Float32Array(0);
  private textures: WebGLTexture[] = [];
  private texOrig: WebGLTexture | null = null;
  private texBlurS: WebGLTexture | null = null;
  private texBlurL: WebGLTexture | null = null;
  private texMasks: WebGLTexture[] = [];
  private scene: SceneParams | null = null;
  private lost = false;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    this.effect = this.program(VERT, EFFECT_FRAG);
    this.blur = this.program(VERT, BLUR_FRAG);
    this.copy = this.program(VERT, COPY_FRAG);
    this.quadPos = gl.createBuffer()!;
    this.quadUv = gl.createBuffer()!;
    this.meshPos = gl.createBuffer()!;
    this.meshUv = gl.createBuffer()!;
    this.meshIdx = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadUv);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  }

  get isLost(): boolean {
    return this.lost;
  }

  private program(vs: string, fs: string): Program {
    const gl = this.gl;
    const compile = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Shader error: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Program error: ${gl.getProgramInfoLog(prog)}`);
    const attribs: Record<string, number> = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveAttrib(prog, i)!;
      attribs[info.name] = gl.getAttribLocation(prog, info.name);
    }
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const un = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < un; i++) {
      const info = gl.getActiveUniform(prog, i)!;
      const name = info.name.replace(/\[0\]$/, '');
      uniforms[name] = gl.getUniformLocation(prog, info.name);
    }
    return { prog, attribs, uniforms };
  }

  private newTexture(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.textures.push(t);
    return t;
  }

  private textureFromCanvas(c: HTMLCanvasElement): WebGLTexture {
    const gl = this.gl;
    const t = this.newTexture();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    return t;
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = this.newTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h };
  }

  private drawQuad(p: Program, w: number, h: number, flipY: number): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadPos);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, w, 0, 0, h, 0, h, w, 0, w, h]), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.a_pos);
    gl.vertexAttribPointer(p.attribs.a_pos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadUv);
    gl.enableVertexAttribArray(p.attribs.a_uv);
    gl.vertexAttribPointer(p.attribs.a_uv, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(p.uniforms.u_res, w, h);
    gl.uniform1f(p.uniforms.u_flipY, flipY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /** Render `src` into a new target of size w x h (bilinear). */
  private resample(src: WebGLTexture, w: number, h: number): Target {
    const gl = this.gl;
    const t = this.target(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.copy.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform1i(this.copy.uniforms.u_tex, 0);
    this.drawQuad(this.copy, w, h, 1);
    return t;
  }

  /** Gaussian blur of `src` (srcW x srcH) producing a texture at (dstW x dstH) with the given sigma in destination pixels. */
  private blurTexture(src: WebGLTexture, srcW: number, srcH: number, dstW: number, dstH: number, sigma: number): WebGLTexture {
    const gl = this.gl;
    // progressive 2x downsampling to avoid aliasing
    let cur = src;
    let cw = srcW;
    let ch = srcH;
    while (cw / 2 >= dstW && ch / 2 >= dstH) {
      cw = Math.max(dstW, Math.round(cw / 2));
      ch = Math.max(dstH, Math.round(ch / 2));
      cur = this.resample(cur, cw, ch).tex;
    }
    let a = cur === src ? this.resample(src, dstW, dstH) : { tex: cur, fbo: null as unknown as WebGLFramebuffer, w: cw, h: ch };
    if (a.w !== dstW || a.h !== dstH || !a.fbo) a = this.resample(a.tex, dstW, dstH);
    const b = this.target(dstW, dstH);
    const iterations = Math.max(1, Math.ceil((sigma / 4) ** 2));
    const s = sigma / Math.sqrt(iterations);
    const n = Math.min(12, Math.max(1, Math.ceil(3 * s)));
    const w = new Float32Array(13);
    let sum = 0;
    for (let i = 0; i <= n; i++) {
      w[i] = Math.exp(-(i * i) / (2 * s * s));
      sum += i === 0 ? w[i] : 2 * w[i];
    }
    for (let i = 0; i <= n; i++) w[i] /= sum;
    gl.useProgram(this.blur.prog);
    gl.uniform1fv(this.blur.uniforms.u_w, w);
    gl.uniform1i(this.blur.uniforms.u_n, n);
    gl.uniform1i(this.blur.uniforms.u_tex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.viewport(0, 0, dstW, dstH);
    for (let it = 0; it < iterations; it++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo);
      gl.bindTexture(gl.TEXTURE_2D, a.tex);
      gl.uniform2f(this.blur.uniforms.u_dir, 1 / dstW, 0);
      this.drawQuad(this.blur, dstW, dstH, 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo);
      gl.bindTexture(gl.TEXTURE_2D, b.tex);
      gl.uniform2f(this.blur.uniforms.u_dir, 0, 1 / dstH);
      this.drawQuad(this.blur, dstW, dstH, 1);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return a.tex;
  }

  /** Upload a new photo + geometry. Must be called before render(). */
  setScene(params: SceneParams): void {
    const gl = this.gl;
    this.disposeTextures();
    this.scene = params;
    const { image, landmarks, masks, faceWidth } = params;
    this.W = image.width;
    this.H = image.height;
    this.canvas.width = this.W;
    this.canvas.height = this.H;

    this.texOrig = this.textureFromCanvas(image);
    const sigmaS = 0.012 * faceWidth;
    const sigmaL = 0.07 * faceWidth;
    const sW = Math.max(1, Math.round(this.W / 2));
    const sH = Math.max(1, Math.round(this.H / 2));
    this.texBlurS = this.blurTexture(this.texOrig, this.W, this.H, sW, sH, sigmaS / 2);
    const lW = Math.max(1, Math.round(this.W / 8));
    const lH = Math.max(1, Math.round(this.H / 8));
    this.texBlurL = this.blurTexture(this.texOrig, this.W, this.H, lW, lH, sigmaL / 8);

    const maskScale = masks.width / this.W;
    const maskSigma = 0.02 * faceWidth * maskScale;
    this.texMasks = [masks.m1, masks.m2, masks.m3].map((c) => {
      const t = this.textureFromCanvas(c);
      return this.blurTexture(t, masks.width, masks.height, masks.width, masks.height, maskSigma);
    });

    // mesh geometry: 468 movable landmarks + fixed outer ring anchors
    const total = MOVABLE + RING;
    this.basePos = new Float32Array(total * 2);
    const uv = new Float32Array(total * 2);
    for (let i = 0; i < MOVABLE; i++) {
      this.basePos[i * 2] = landmarks[i].x;
      this.basePos[i * 2 + 1] = landmarks[i].y;
    }
    const c = faceCenter(landmarks);
    LM.FACE_OVAL.forEach((idx, i) => {
      const p = landmarks[idx];
      this.basePos[(MOVABLE + i) * 2] = c.x + (p.x - c.x) * 1.7;
      this.basePos[(MOVABLE + i) * 2 + 1] = c.y + (p.y - c.y) * 1.7;
    });
    for (let i = 0; i < total; i++) {
      uv[i * 2] = this.basePos[i * 2] / this.W;
      uv[i * 2 + 1] = this.basePos[i * 2 + 1] / this.H;
    }
    this.curPos = Float32Array.from(this.basePos);
    const faceTris = getMeshTriangles(landmarks);
    const idx: number[] = Array.from(faceTris);
    for (let i = 0; i < RING; i++) {
      const o0 = LM.FACE_OVAL[i];
      const o1 = LM.FACE_OVAL[(i + 1) % RING];
      const r0 = MOVABLE + i;
      const r1 = MOVABLE + ((i + 1) % RING);
      idx.push(o0, o1, r0, r0, o1, r1);
    }
    this.indexCount = idx.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUv);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPos);
    gl.bufferData(gl.ARRAY_BUFFER, this.curPos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  }

  /** Displace the mesh for the given warp tools. */
  setWarps(tools: WarpTool[]): void {
    if (!this.scene) return;
    applyWarps(this.basePos, tools, this.curPos, MOVABLE);
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPos);
    gl.bufferData(gl.ARRAY_BUFFER, this.curPos, gl.DYNAMIC_DRAW);
  }

  render(fx: EffectUniforms): void {
    const gl = this.gl;
    const sc = this.scene;
    if (!sc || this.lost) return;
    const p = this.effect;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p.prog);
    const bind = (unit: number, tex: WebGLTexture | null, name: string) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(p.uniforms[name], unit);
    };
    bind(0, this.texOrig, 'u_orig');
    bind(1, this.texBlurS, 'u_blurS');
    bind(2, this.texBlurL, 'u_blurL');
    bind(3, this.texMasks[0], 'u_mask1');
    bind(4, this.texMasks[1], 'u_mask2');
    bind(5, this.texMasks[2], 'u_mask3');
    gl.uniform1f(p.uniforms.u_forehead, fx.forehead);
    gl.uniform1f(p.uniforms.u_glabella, fx.glabella);
    gl.uniform1f(p.uniforms.u_crows, fx.crows);
    gl.uniform1f(p.uniforms.u_folds, fx.folds);
    gl.uniform1f(p.uniforms.u_underEye, fx.underEye);
    gl.uniform1f(p.uniforms.u_resurface, fx.resurface);
    gl.uniform1f(p.uniforms.u_tone, fx.tone);
    gl.uniform1f(p.uniforms.u_redness, fx.redness);
    gl.uniform1f(p.uniforms.u_glow, fx.glow);
    gl.uniform1f(p.uniforms.u_lips, fx.lips);
    gl.uniform1f(p.uniforms.u_matte, fx.matte);
    gl.uniform1f(p.uniforms.u_perioral, fx.perioral);
    gl.uniform3f(p.uniforms.u_skinMean, sc.skinMean[0], sc.skinMean[1], sc.skinMean[2]);
    gl.uniform3f(p.uniforms.u_cheekMean, sc.cheekMean[0], sc.cheekMean[1], sc.cheekMean[2]);
    gl.uniform1f(p.uniforms.u_globalRed, sc.globalRedness);

    // background: the whole photo, unwarped
    this.drawQuad(p, this.W, this.H, -1);

    // face mesh (possibly warped) on top
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshPos);
    gl.enableVertexAttribArray(p.attribs.a_pos);
    gl.vertexAttribPointer(p.attribs.a_pos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshUv);
    gl.enableVertexAttribArray(p.attribs.a_uv);
    gl.vertexAttribPointer(p.attribs.a_uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIdx);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  /** Current frame as a canvas copy (safe to keep after further renders). */
  snapshot(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    c.getContext('2d')!.drawImage(this.canvas, 0, 0);
    return c;
  }

  private disposeTextures(): void {
    for (const t of this.textures) this.gl.deleteTexture(t);
    this.textures = [];
    this.texMasks = [];
    this.texOrig = this.texBlurS = this.texBlurL = null;
  }

  dispose(): void {
    this.disposeTextures();
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}
