// Runs on every web page. Draws the charm on a see-through layer above the page.
import {
  AmbientLight, BufferAttribute, BufferGeometry, Color, DirectionalLight, Line,
  LineBasicMaterial, LineDashedMaterial, PerspectiveCamera, Scene, WebGLRenderer,
} from "three";
import { buildCharm, type BuiltCharm } from "./charm";
import { SwingPhysics } from "./physics";
import { withDefaults, type CharmConfig, type GetCharmResponse } from "./types";

const FOV = 40;

class Overlay {
  private canvas = document.createElement("canvas");
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 1, 5000);
  private w = 1;
  private h = 1;

  private charm: BuiltCharm | null = null;
  private cfg: CharmConfig | null = null;
  private physics: SwingPhysics | null = null;
  private thread: Line | null = null;
  private threadPos: Float32Array | null = null;

  private mouseX = 0;
  private mouseY = 0;
  private seenMouse = false;
  private running = false;
  private last = 0;
  private idle = 0;
  private loadToken = 0;
  private time = 0;

  constructor() {
    Object.assign(this.canvas.style, {
      position: "fixed", left: "0", top: "0", pointerEvents: "none",
      zIndex: "2147483647", background: "transparent",
    });
    this.canvas.setAttribute("aria-hidden", "true");
    document.documentElement.appendChild(this.canvas);

    this.renderer = new WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene.add(new AmbientLight(0xffffff, 1.5));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(-0.4, 0.7, 1);
    this.scene.add(sun);

    this.resize();
    window.addEventListener("resize", () => { this.resize(); this.wake(); });
    window.addEventListener("pointermove", (e) => this.onMove(e), { passive: true, capture: true });
    document.documentElement.addEventListener("mouseleave", () => this.setVisible(false));
    document.documentElement.addEventListener("mouseenter", () => this.setVisible(true));
  }

  private resize() {
    this.w = document.documentElement.clientWidth || window.innerWidth;
    this.h = document.documentElement.clientHeight || window.innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
    // Put the camera so that 1 unit in the scene = 1 pixel on screen at z = 0.
    const dist = this.h / 2 / Math.tan((FOV * Math.PI) / 360);
    this.camera.aspect = this.w / this.h;
    this.camera.far = dist * 3 + 2000;
    this.camera.position.set(this.w / 2, this.h / 2, dist);
    this.camera.lookAt(this.w / 2, this.h / 2, 0);
    this.camera.updateProjectionMatrix();
  }

  private setVisible(v: boolean) {
    this.canvas.style.visibility = v ? "visible" : "hidden";
  }

  private onMove(e: PointerEvent) {
    this.mouseX = e.clientX;
    this.mouseY = this.h - e.clientY; // flip: scene y goes UP
    this.idle = 0;
    if (!this.seenMouse) {
      this.seenMouse = true;
      this.physics?.reset(this.mouseX, this.mouseY);
    }
    this.setVisible(true);
    this.wake();
  }

  // ---- loading a charm ----
  async load(id?: string) {
    const token = ++this.loadToken;
    if (id === "off") { this.clear(); this.canvas.style.display = "none"; return; }
    this.canvas.style.display = "block";
    let res: GetCharmResponse;
    try {
      res = await chrome.runtime.sendMessage({ type: "getCharm", id });
    } catch { return; } // extension was reloaded; this old page script stops quietly
    if (!res?.ok || token !== this.loadToken) return;

    const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: res.mime }));
    if (token !== this.loadToken) return;

    this.clear();
    const cfg = withDefaults(res.config);
    this.cfg = cfg;
    this.charm = buildCharm(cfg, bitmap);
    this.scene.add(this.charm.group);

    this.physics = new SwingPhysics(
      { length: cfg.threadLength, weight: cfg.weight, drag: cfg.drag, spin: cfg.spin,
        twistStiffness: cfg.twistStiffness, twistDamping: cfg.twistDamping },
      this.mouseX, this.mouseY,
    );

    const count = this.physics.count;
    this.threadPos = new Float32Array(count * 3);
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(this.threadPos, 3));
    const color = new Color(cfg.threadColor);
    const mat = cfg.threadStyle === "dotted"
      ? new LineDashedMaterial({ color, dashSize: 2, gapSize: 3 })
      : new LineBasicMaterial({ color });
    this.thread = new Line(geo, mat);
    this.thread.frustumCulled = false;
    this.scene.add(this.thread);

    this.charm.group.visible = this.thread.visible = this.seenMouse;
    this.wake();
  }

  private clear() {
    if (this.charm) { this.scene.remove(this.charm.group); this.charm.dispose(); this.charm = null; }
    if (this.thread) {
      this.scene.remove(this.thread);
      this.thread.geometry.dispose();
      (this.thread.material as LineBasicMaterial).dispose();
      this.thread = null;
    }
    this.physics = null;
    this.renderer.render(this.scene, this.camera);
  }

  // ---- the animation loop (sleeps when nothing moves, to save battery) ----
  private wake() {
    if (this.running || !this.physics) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (t: number) => {
    if (!this.running) return;
    const dt = Math.min((t - this.last) / 1000, 0.05);
    this.last = t;
    this.idle += dt;
    this.time += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.physics?.settled && this.idle > 0.4) { this.running = false; return; }
    requestAnimationFrame(this.tick);
  };

  private update(dt: number) {
    const p = this.physics, c = this.charm, th = this.thread, tp = this.threadPos;
    if (!p || !c || !th || !tp || !this.cfg) return;

    p.step(dt, this.mouseX, this.mouseY);

    for (let i = 0; i < p.count; i++) {
      tp[i * 3] = p.x[i]; tp[i * 3 + 1] = p.y[i]; tp[i * 3 + 2] = -0.5;
    }
    th.geometry.attributes.position.needsUpdate = true;
    if (this.cfg.threadStyle === "dotted") th.computeLineDistances();

    c.group.position.set(p.ringX, p.ringY, 0);
    c.group.rotation.z = p.angle;
    c.pivot.rotation.y = p.yaw;
    if (c.glow) {
      (c.glow.material as { opacity: number }).opacity = 0.75 + 0.1 * Math.sin(this.time * 2);
    }
  }
}

function start() {
  if (window.top !== window) return;                       // only the main page, not iframes
  if (!document.documentElement || document.contentType !== "text/html") return;
  let overlay: Overlay;
  try { overlay = new Overlay(); } catch { return; }        // no WebGL on this page: do nothing

  chrome.storage.sync.get("charm").then((s) => overlay.load(s.charm));
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.charm) overlay.load(changes.charm.newValue);
  });
}
start();
