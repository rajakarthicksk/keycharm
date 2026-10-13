// The little menu when you click the extension icon: pick a charm or turn it off.
const select = document.getElementById("charm") as HTMLSelectElement;

async function main() {
  const index = await (await fetch("charms/index.json")).json();
  const stored = await chrome.storage.sync.get("charm");
  const current: string = stored.charm ?? index.default;

  for (const id of index.charms as string[]) {
    const cfg = await (await fetch(`charms/${id}/charm.json`)).json();
    select.add(new Option(cfg.name ?? id, id));
  }
  select.add(new Option("Off", "off"));
  select.value = current;

  select.addEventListener("change", () => chrome.storage.sync.set({ charm: select.value }));
}
main();
