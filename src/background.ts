// Background worker: reads the charm files and sends them to the page.
// (It does this so the page never has to load files itself, which some websites block.)
import type { GetCharmRequest, GetCharmResponse } from "./types";

const url = (p: string) => chrome.runtime.getURL(p);

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function getCharm(wanted?: string): Promise<GetCharmResponse> {
  try {
    const index = await (await fetch(url("charms/index.json"))).json();
    const id: string = wanted && index.charms.includes(wanted) ? wanted : index.default;
    const config = await (await fetch(url(`charms/${id}/charm.json`))).json();
    const img = await fetch(url(`charms/${id}/${config.image}`));
    const mime = img.headers.get("content-type") || "image/png";
    return { ok: true, id, config, mime, base64: toBase64(await img.arrayBuffer()) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg: GetCharmRequest, _sender, sendResponse) => {
  if (msg?.type !== "getCharm") return;
  getCharm(msg.id).then(sendResponse);
  return true; // we answer later (async)
});
