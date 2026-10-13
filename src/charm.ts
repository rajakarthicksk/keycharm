// Turns a picture + settings into a 3D object (a thick sticker, optionally glowing).
import {
  AdditiveBlending, CanvasTexture, Color, DoubleSide, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, SRGBColorSpace,
} from "three";
import { buildStickerGeometry } from "./geometry";
import { outlineFromAlpha } from "./outline";
import type { CharmConfig } from "./types";

export interface BuiltCharm {
  group: Group;   // tilts with the thread. Origin = the ring point.
  pivot: Group;   // twists around the thread (yaw)
  glow: Mesh | null;
  dispose(): void;
}

function drawToCanvas(bitmap: ImageBitmap, maxDim: number) {
  const k = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * k));
  const h = Math.max(1, Math.round(bitmap.height * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return { canvas: c, ctx, w, h };
}

function makeGlowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function buildCharm(cfg: CharmConfig, bitmap: ImageBitmap): BuiltCharm {
  // 1) the picture used as the sticker's paint
  const art = drawToCanvas(bitmap, 512);
  const texture = new CanvasTexture(art.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;

  // 2) the outline (cookie cutter) from a small copy of the picture
  const small = drawToCanvas(bitmap, 128);
  const data = small.ctx.getImageData(0, 0, small.w, small.h).data;
  const alpha = new Uint8Array(small.w * small.h);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = data[i * 4 + 3];
    if (alpha[i] > 200) { r += data[i * 4]; g += data[i * 4 + 1]; b += data[i * 4 + 2]; n++; }
  }
  const outline = outlineFromAlpha(alpha, small.w, small.h);
  const edgeColor = n
    ? new Color(r / n / 255, g / n / 255, b / n / 255).multiplyScalar(0.7)
    : new Color(0.3, 0.3, 0.3);
  edgeColor.convertSRGBToLinear();

  // 3) the thick sticker
  const sticker = buildStickerGeometry(outline, art.w / art.h, cfg.size, cfg.thickness, cfg.ring);
  const faceMat = new MeshStandardMaterial({ map: texture, alphaTest: 0.5, roughness: 0.5, metalness: 0.15, side: DoubleSide });
  const edgeMat = new MeshStandardMaterial({ color: edgeColor, roughness: 0.6, metalness: 0.1 });
  const mesh = new Mesh(sticker.geometry, [faceMat, edgeMat]);

  const group = new Group();
  const pivot = new Group();
  pivot.add(mesh);
  group.add(pivot);

  // 4) optional glow behind the charm
  let glow: Mesh | null = null;
  let glowTex: CanvasTexture | null = null;
  if (cfg.glow) {
    glowTex = makeGlowTexture();
    const gm = new MeshBasicMaterial({
      map: glowTex, color: new Color(cfg.glowColor), transparent: true, opacity: 0.85,
      blending: AdditiveBlending, depthWrite: false,
    });
    glow = new Mesh(new PlaneGeometry(1, 1), gm);
    const gs = cfg.size * cfg.glowSize;
    glow.scale.set(gs, gs, 1);
    glow.position.set((0.5 - cfg.ring[0]) * sticker.widthPx, -(0.5 - cfg.ring[1]) * sticker.heightPx, -sticker.depth);
    group.add(glow);
  }

  return {
    group, pivot, glow,
    dispose() {
      sticker.geometry.dispose();
      faceMat.dispose(); edgeMat.dispose(); texture.dispose();
      if (glow) { glow.geometry.dispose(); (glow.material as MeshBasicMaterial).dispose(); }
      glowTex?.dispose();
    },
  };
}
