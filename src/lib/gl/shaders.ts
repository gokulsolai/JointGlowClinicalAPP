export const VERT = `
attribute vec2 a_pos;
attribute vec2 a_uv;
uniform vec2 u_res;
uniform float u_flipY;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  vec2 clip = a_pos / u_res * 2.0 - 1.0;
  gl_Position = vec4(clip.x, clip.y * u_flipY, 0.0, 1.0);
}`;

export const COPY_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
void main() { gl_FragColor = texture2D(u_tex, v_uv); }`;

export const BLUR_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_dir;
uniform float u_w[13];
uniform int u_n;
void main() {
  vec4 c = texture2D(u_tex, v_uv) * u_w[0];
  for (int i = 1; i < 13; i++) {
    if (i > u_n) break;
    vec2 o = u_dir * float(i);
    c += (texture2D(u_tex, v_uv + o) + texture2D(u_tex, v_uv - o)) * u_w[i];
  }
  gl_FragColor = c;
}`;

/**
 * Treatment simulation shader. Works on the original image plus two Gaussian-blurred copies
 * (frequency separation) and three RGBA zone-mask textures.
 */
export const EFFECT_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_orig;
uniform sampler2D u_blurS;
uniform sampler2D u_blurL;
uniform sampler2D u_mask1; // r forehead, g glabella, b crow's feet, a folds
uniform sampler2D u_mask2; // r under-eye, g lips, b skin, a T-zone
uniform sampler2D u_mask3; // r perioral, g cheeks, b chin, a nose
uniform float u_forehead;
uniform float u_glabella;
uniform float u_crows;
uniform float u_folds;
uniform float u_underEye;
uniform float u_resurface;
uniform float u_tone;
uniform float u_redness;
uniform float u_glow;
uniform float u_lips;
uniform float u_matte;
uniform float u_perioral;
uniform vec3 u_skinMean;
uniform vec3 u_cheekMean;
uniform float u_globalRed;

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec3 o = texture2D(u_orig, v_uv).rgb;
  vec3 bs = texture2D(u_blurS, v_uv).rgb;
  vec3 bl = texture2D(u_blurL, v_uv).rgb;
  vec4 m1 = texture2D(u_mask1, v_uv);
  vec4 m2 = texture2D(u_mask2, v_uv);
  vec4 m3 = texture2D(u_mask3, v_uv);
  float skin = m2.b;

  // 1. fine-detail reduction (frequency separation) in the treated zones
  float k = m1.r * u_forehead + m1.g * u_glabella + m1.b * u_crows + m1.a * u_folds * 0.75
          + m2.r * u_underEye * 0.7 + m3.r * u_perioral * 0.85
          + skin * (u_resurface * 0.6 + u_glow * 0.25 + u_tone * 0.2);
  k = clamp(k, 0.0, 0.92);
  vec3 c = bs + (o - bs) * (1.0 - k);

  // 2. lift groove shadows in folds and under the eyes toward the local mean
  float shadow = max(0.0, lum(bl) - lum(c));
  float ws = clamp(m1.a * u_folds * 0.9 + m2.r * u_underEye * 0.9, 0.0, 1.0);
  c = mix(c, bl, clamp(shadow * 6.0, 0.0, 1.0) * ws);

  // 3. under-eye tone toward the cheek tone
  c += (u_cheekMean - bl) * 0.75 * m2.r * u_underEye;

  // 4. tone evening: lift darker spots toward the local mean luminance
  float wt = skin * clamp(u_tone + 0.5 * u_resurface, 0.0, 1.0);
  float lc = lum(c);
  float dark = max(0.0, lum(bl) - lc);
  float lift = clamp(dark * 8.0, 0.0, 1.0) * wt;
  c = mix(c, c * (lum(bl) / max(lc, 0.02)), lift);

  // 5. redness reduction (global tone and local patches)
  float wr = skin * u_redness;
  vec3 d = c - u_skinMean;
  float redEx = max(0.0, d.r - 0.5 * (d.g + d.b));
  vec3 dl = c - bl;
  float redLocal = max(0.0, dl.r - 0.5 * (dl.g + dl.b));
  float red = (0.5 * redEx + redLocal + u_globalRed * 0.08) * wr;
  c += vec3(-0.9, 0.35, 0.25) * red;

  // 6. matte: reduce specular shine in the T-zone
  float spec = max(0.0, lum(o) - lum(bl) - 0.06);
  c = mix(c, bl, clamp(spec * 6.0, 0.0, 1.0) * m2.a * u_matte * 0.8);

  // 7. glow: slight brightness and saturation lift over the skin
  float wg = skin * u_glow;
  float l2 = lum(c);
  c = mix(c, mix(vec3(l2), c, 1.08) * 1.045 + 0.015, wg);

  // 8. lips: a touch more colour and gloss
  float wl = m2.g * u_lips;
  float l3 = lum(c);
  c = mix(c, mix(vec3(l3), c, 1.18) * 1.03, wl);

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
