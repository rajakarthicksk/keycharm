// Turns a picture's see-through background into an outline (list of points).
// This outline is the "cookie cutter" shape we push out into a thick sticker.

export type P = [number, number]; // normalised 0..1, x right, y DOWN (picture coordinates)

const DIRS: P[] = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]]; // clockwise from west

function dirIndex(dx: number, dy: number): number {
  for (let i = 0; i < 8; i++) if (DIRS[i][0] === dx && DIRS[i][1] === dy) return i;
  return 0;
}

export function outlineFromAlpha(alpha: ArrayLike<number>, w: number, h: number, threshold = 40): P[] {
  const W = w + 2, H = h + 2; // 1 pixel of empty border so we never walk off the edge
  const m = new Uint8Array(W * H);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) m[(y + 1) * W + x + 1] = alpha[y * w + x] > threshold ? 1 : 0;

  // keep only the biggest connected blob
  const label = new Int32Array(W * H);
  let best = 0, bestSize = 0, next = 1;
  const stack: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!m[i] || label[i]) continue;
    let size = 0;
    stack.push(i); label[i] = next;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of DIRS) {
        const n = (cy + dy) * W + cx + dx;
        if (m[n] && !label[n]) { label[n] = next; stack.push(n); }
      }
    }
    if (size > bestSize) { bestSize = size; best = next; }
    next++;
  }
  if (!best) return rect();

  const mm = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mm[i] = label[i] === best ? 1 : 0;

  // first pixel in reading order
  let start = 0;
  while (!mm[start]) start++;
  const sx = start % W, sy = (start / W) | 0;

  // walk around the edge (Moore neighbour tracing)
  const pts: P[] = [];
  let cx = sx, cy = sy, bx = sx - 1, by = sy;
  const b0x = bx, b0y = by;
  const limit = W * H * 4;
  do {
    const bi = dirIndex(bx - cx, by - cy);
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const di = (bi + k) % 8;
      const nx = cx + DIRS[di][0], ny = cy + DIRS[di][1];
      if (mm[ny * W + nx]) {
        const pd = (bi + k - 1) % 8;
        bx = cx + DIRS[pd][0];
        by = cy + DIRS[pd][1];
        cx = nx; cy = ny;
        found = true;
        break;
      }
    }
    if (!found) break;
    pts.push([cx - 1 + 0.5, cy - 1 + 0.5]);
  } while (!(cx === sx && cy === sy && bx === b0x && by === b0y) && pts.length < limit);

  if (pts.length < 3) return rect();

  const simple = simplifyClosed(pts, 0.9);
  if (simple.length < 3) return rect();
  return simple.map(([x, y]) => [x / w, y / h] as P);
}

function rect(): P[] { return [[0, 0], [1, 0], [1, 1], [0, 1]]; }

// Ramer–Douglas–Peucker: removes points that lie almost on a straight line.
function simplifyClosed(pts: P[], eps: number): P[] {
  const open = [...pts, pts[0]];
  const out = rdp(open, eps);
  out.pop();
  return out;
}

function rdp(pts: P[], eps: number): P[] {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSeg(pts[i], a, b);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [a, b];
  const left = rdp(pts.slice(0, idx + 1), eps);
  const right = rdp(pts.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

function distToSeg(p: P, a: P, b: P): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
