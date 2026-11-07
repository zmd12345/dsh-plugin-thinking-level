#!/usr/bin/env node
/**
 * 填入 GitHub owner，生成 package.json 的 repository/homepage
 * 以及 awesome-dsh-plugin 的收录条目。
 *
 * 用法：node scripts/prepare-release.mjs <github-owner>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const owner = process.argv[2];
if (!owner || !/^[A-Za-z0-9_.-]+$/u.test(owner)) {
	console.error("用法：node scripts/prepare-release.mjs <github-owner>");
	process.exit(1);
}

const root = new URL("..", import.meta.url).pathname;
const repo = "dsh-plugin-thinking-level";
const url = `https://github.com/${owner}/${repo}`;

const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const version = pkg.version;
pkg.homepage = url;
pkg.repository = { type: "git", url: `${url}.git` };
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const entry = `url: ${url}
name: ${owner}/${repo}
category: usage
description:
  en: Suggests the right thinking level for the current draft and can switch it in one click, so simple tasks avoid overthinking and hard tasks get enough reasoning.
  zh: 根据当前草稿自动建议思考档位并支持一键切换：简单任务不过度思考、节省 token，复杂任务给足推理、减少返工。
icon: https://raw.githubusercontent.com/${owner}/${repo}/main/assets/icon-180.png
tarball: https://github.com/${owner}/${repo}/releases/latest/download/${repo}.tgz
`;

const dir = join(root, "market", "data", "plugins");
mkdirSync(dir, { recursive: true });
const entryPath = join(dir, `${owner}__${repo}.yml`);
writeFileSync(entryPath, entry);

console.log(`updated ${pkgPath}`);
console.log(`wrote   ${entryPath}`);
console.log(`next: git init && git add . && git commit && git remote add origin ${url}.git && git push -u origin main`);
