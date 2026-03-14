import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");

async function read(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function getOrderedFiles(dirPath) {
  const entries = await fs.readdir(dirPath);
  return entries.sort().map((entry) => path.join(dirPath, entry));
}

async function build() {
  const template = await read(path.join(srcDir, "index.template.html"));
  const cssFiles = await getOrderedFiles(path.join(srcDir, "css"));
  const jsFiles = await getOrderedFiles(path.join(srcDir, "js"));

  const css = (await Promise.all(cssFiles.map(read))).join("\n\n");
  const js = (await Promise.all(jsFiles.map(read))).join("\n\n");

  const html = template
    .replace("/*__INLINE_CSS__*/", css)
    .replace("/*__INLINE_JS__*/", js);

  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(path.join(distDir, "monster-mint.html"), html, "utf8");
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

