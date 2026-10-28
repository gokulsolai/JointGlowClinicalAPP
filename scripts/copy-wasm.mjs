// Copies the MediaPipe Tasks Vision WASM runtime from node_modules into public/wasm
// so the app can load it from the same origin (no CDN dependency, works offline as a PWA).
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const dest = join(root, 'public', 'wasm');

if (!existsSync(src)) {
  console.error('[copy-wasm] @mediapipe/tasks-vision is not installed. Run `npm install` first.');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
// FilesetResolver.forVisionTasks() loads vision_wasm_internal.* (SIMD) or vision_wasm_nosimd_internal.*;
// the *_module_* variants are only used with useModule=true, so they are not shipped.
const files = readdirSync(src).filter((f) => !f.includes('_module_'));
for (const f of files) cpSync(join(src, f), join(dest, f));
console.log(`[copy-wasm] copied ${files.length} files to public/wasm`);
