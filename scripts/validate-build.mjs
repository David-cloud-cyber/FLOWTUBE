import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const files = ["index.html"];
const contents = await Promise.all(files.map((file) => readFile(new URL(file, root), "utf8")));

for (const [file, html] of files.map((file, index) => [file, contents[index]])) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  if (!scripts.length) throw new Error(`${file}: no inline script found`);
  for (const [, source] of scripts) {
    new Function(source);
  }
  if (!/<html\b/i.test(html) || !/<body\b/i.test(html)) throw new Error(`${file}: invalid HTML shell`);
}

console.log(`Validated ${files.length} application HTML file and ${contents[0].match(/<script(?:\s[^>]*)?>/gi).length} inline script block(s).`);
