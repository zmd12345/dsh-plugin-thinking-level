#!/usr/bin/env node
/**
 * 检查 DSH profile 里 LLM provider 的推理档位配置。
 *
 * 背景：宿主的压缩摘要请求（dsh-compaction-basic 的 summarizeWithLlm）构造请求时
 * 不带 reasoningEffort，回落到 provider 的默认档位（profile.reasoning）。若 provider
 * 没配这个默认值，请求就会以 thinking.type=disabled 发出——MiniMax-M3.1-Flash 这类
 * 强制 adaptive thinking 的模型会被服务端以 400 拒绝，于是 /compact 和自动压缩全部失败。
 *
 * 用法：
 *   node scripts/check-compaction.mjs [profile-patch.yaml ...]
 *
 * 默认检查 ~/.dsh/profiles 下各 profile 的 cordis.patch.yml。发现问题时打印需要补上的配置。
 * 只读检查，不修改任何文件。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_ROOT = join(homedir(), ".dsh", "profiles");

/**
 * 从 profile patch 的文本里找出 llm-pi-ai 服务下各 provider 的关键字段。
 * 只做这次检查需要的几件事：provider 名、是否声明了 reasoningEfforts、是否有 reasoning 默认档位。
 *
 * @param {string} text profile patch 的完整文本
 * @returns {Array<{name: string, hasReasoningEfforts: boolean, hasDefaultReasoning: boolean}>}
 */
function parseProviders(text) {
	const lines = text.split("\n");
	const providers = [];
	let inProviders = false;
	let providersIndent = 0;
	let current = null;

	const indentOf = (line) => line.length - line.trimStart().length;

	for (const raw of lines) {
		const line = raw.replace(/\t/g, "  ");
		if (line.trim() === "" || line.trimStart().startsWith("#")) continue;

		const indent = indentOf(line);
		const trimmed = line.trim();

		// 顶层 providers: 块
		if (/^providers:\s*$/.test(trimmed)) {
			inProviders = true;
			providersIndent = indent;
			current = null;
			continue;
		}
		if (!inProviders) continue;

		// 离开 providers 块（缩进回退）
		if (indent <= providersIndent) {
			inProviders = false;
			current = null;
			continue;
		}

		// provider 名：providers 块下的第一层 key
		if (indent === providersIndent + 2 && /^[A-Za-z0-9_.-]+:\s*$/.test(trimmed)) {
			current = {
				name: trimmed.replace(/:\s*$/, ""),
				hasReasoningEfforts: false,
				hasDefaultReasoning: false
			};
			providers.push(current);
			continue;
		}
		if (current === null) continue;

		// provider 的直接字段（reasoning: 默认档位）
		if (indent === providersIndent + 4 && /^reasoning:\s*\S/.test(trimmed)) {
			current.hasDefaultReasoning = true;
		}
		// reasoningEfforts 声明在 models 列表项里，深度不定，只要落在本 provider 块内即可
		if (/^reasoningEfforts:/.test(trimmed)) {
			current.hasReasoningEfforts = true;
		}
	}
	return providers;
}

/** 列出要检查的 profile patch 文件。 */
function defaultPatches() {
	if (!existsSync(DEFAULT_ROOT)) return [];
	const out = [];
	for (const profile of readdirSync(DEFAULT_ROOT)) {
		const file = join(DEFAULT_ROOT, profile, "cordis.patch.yml");
		if (existsSync(file)) out.push(file);
	}
	return out;
}

const args = process.argv.slice(2);
const files = args.length > 0 ? args : defaultPatches();
if (files.length === 0) {
	console.log("没有找到 profile patch 文件。");
	process.exit(0);
}

let problems = 0;
for (const file of files) {
	let text;
	try {
		text = readFileSync(file, "utf8");
	} catch (error) {
		console.log(`跳过 ${file}：${error.message}`);
		continue;
	}
	const providers = parseProviders(text);
	const affected = providers.filter((p) => p.hasReasoningEfforts && !p.hasDefaultReasoning);
	if (affected.length === 0) continue;

	console.log(`\n${file}`);
	for (const provider of affected) {
		problems++;
		console.log(`  provider "${provider.name}"：声明了 reasoningEfforts，但没有默认推理档位（reasoning）。`);
		console.log(`    → 该路由上的压缩摘要请求会发出 thinking.type=disabled，`);
		console.log(`      对强制 adaptive thinking 的模型（如 MiniMax-M3.1-Flash）会被服务端以 400 拒绝，`);
		console.log(`      表现为 /compact 与自动压缩全部失败。`);
	}
	console.log(`    修法：在该 provider 下加一行（档位按模型实际支持的填）：`);
	for (const provider of affected) {
		console.log("");
		console.log(`      ${provider.name}:`);
		console.log(`        reasoning: medium`);
	}
}

if (problems === 0) {
	console.log("\n检查完成：所有声明了 reasoningEfforts 的 provider 都配了默认推理档位。");
} else {
	console.log(`\n检查完成：${problems} 个 provider 需要补默认推理档位。`);
}
