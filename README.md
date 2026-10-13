# Mouse Charm (v0.1)

A 3D "thick sticker" charm that dangles from your mouse pointer on a thread.

## Try it (no Node needed)
1. Unzip this folder.
2. Open Chrome -> `chrome://extensions`
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the **`dist`** folder.
5. Open any normal web page and move the mouse.
   (It does not work on `chrome://` pages or the Chrome Web Store.)
6. Click the extension icon to pick a charm or turn it Off.

## Add your own charm
1. Copy a folder in `public/charms/` (for example `sun`) and rename it (for example `heart`).
2. Put your PNG inside (see-through background, one connected shape, with a small ring touching the top).
3. Edit `charm.json`: image name, `ring` (where the thread ties, 0..1 from top-left), weight, thread length, glow...
4. Add the folder name to `public/charms/index.json`.
5. Rebuild: `npm install` then `npm run build`, and press the reload button on the extension.

## Files
- `src/content.ts`  the page overlay + animation loop (the "brain")
- `src/physics.ts`  swinging thread, weight, twist
- `src/outline.ts`  picture -> cookie-cutter outline
- `src/geometry.ts` outline -> thick 3D sticker
- `src/charm.ts`    sticker + paint + glow
- `src/background.ts` reads charm files for the page
- `src/popup.ts`    the picker menu
