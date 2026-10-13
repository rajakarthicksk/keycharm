import { build } from "esbuild";
import fs from "node:fs";

fs.rmSync("dist", { recursive: true, force: true });
fs.mkdirSync("dist", { recursive: true });

await build({
  entryPoints: {
    content: "src/content.ts",
    background: "src/background.ts",
    popup: "src/popup.ts",
  },
  bundle: true,
  minify: true,
  format: "iife",
  target: "chrome110",
  outdir: "dist",
  legalComments: "none",
});

fs.cpSync("public", "dist", { recursive: true });
console.log("Built -> dist/");
