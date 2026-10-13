// Builds the thick-sticker shape from an outline. No browser APIs, so it runs in tests too.
import { ExtrudeGeometry, Shape } from "three";
import type { P } from "./outline";

export interface StickerGeometry {
  geometry: ExtrudeGeometry;
  widthPx: number;
  heightPx: number;
  depth: number;
}

/**
 * outline: points in picture coordinates (0..1, y down).
 * aspect: picture width / height.
 * The ring point (rx, ry) becomes the origin (0,0,0), and the charm hangs down (-y).
 */
export function buildStickerGeometry(
  outline: P[],
  aspect: number,
  size: number,
  thickness: number,
  ring: [number, number],
): StickerGeometry {
  const [rx, ry] = ring;
  const widthPx = aspect >= 1 ? size : size * aspect;
  const heightPx = aspect >= 1 ? size / aspect : size;

  const toLocal = ([u, v]: P): [number, number] => [(u - rx) * widthPx, -(v - ry) * heightPx];

  const make = (pts: P[]) => {
    const shape = new Shape();
    pts.forEach((p, i) => {
      const [x, y] = toLocal(p);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();

    const total = Math.max(2, thickness * size);
    const bevelT = total * 0.18;
    const bevelS = Math.min(total * 0.3, size * 0.02);
    const depth = Math.max(0.5, total - 2 * bevelT);
    const g = new ExtrudeGeometry(shape, {
      depth,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: bevelT,
      bevelSize: bevelS,
      bevelOffset: -bevelS,
      bevelSegments: 3,
      curveSegments: 1,
    });
    g.translate(0, 0, -depth / 2);
    return { g, depth: total };
  };

  let built;
  try {
    built = make(outline);
  } catch {
    built = make([[0, 0], [1, 0], [1, 1], [0, 1]]); // safe fallback: rectangle
  }
  const { g: geometry, depth } = built;

  // Map the picture onto the front and back faces.
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    uv.setXY(i, x / widthPx + rx, 1 - ry + y / heightPx);
  }
  uv.needsUpdate = true;

  return { geometry, widthPx, heightPx, depth };
}
