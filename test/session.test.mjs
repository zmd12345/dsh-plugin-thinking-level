import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
let JSDOM;
let React;
let ReactDOMClient;
let act;
try {
	({ JSDOM } = await import("jsdom"));
	React = (await import("react")).default;
	ReactDOMClient = await import("react-dom/client");
	({ act } = await import("react-dom/test-utils"));
} catch (_error) {
	console.log("skip: 需要 react / react-dom / jsdom 才能跑会话提醒用例");
	process.exit(0);
}

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
let definition = null;
dom.window.__ModuleLoader__ = { load(value) { definition = value; } };
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vm.runInNewContext(readFileSync(fileURLToPath(new URL("../lib/client.js", import.meta.url)), "utf8"), {
	window: dom.window, document: dom.window.document, console, setTimeout, clearTimeout
}, { filename: "client.js" });

const mod = definition.factory((id) => {
	if (id === "react") return React;
	throw new Error(`unexpected require: ${id}`);
});

function store(initial) {
	let value = initial;
	const listeners = new Set();
	return {
		getSnapshot() { return value; },
		subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
		set(next) { value = next; for (const listener of [...listeners]) listener(); }
	};
}

const catalog = {
	default: { provider: "p", model: "m", reasoningEffort: "low" },
	groups: [{ id: "p", models: [{ id: "m", reasoning: { defaultEffort: "low", efforts: [{ id: "low", name: "Low" }, { id: "high", name: "High" }] } }] }]
};

const container = document.getElementById("root");

async function render({ draft = "", turns = 32, usage = null, pressure = null, outline = [], subagent = null, createSession = null } = {}) {
	const inputState = store({ draft, phase: "plain", attachmentIds: [], draftRev: 0 });
	const selectionStore = store({ next: { provider: "p", model: "m", reasoningEffort: "low" } });
	const sessionStore = store({ blank: false, subagent, running: false });
	const statsStore = store({ turns, steps: turns });
	const usageStore = store(usage);
	const pressureStore = store(pressure);
	const outlineStore = store(outline);
	container.innerHTML = "";
	const root = ReactDOMClient.createRoot(container);
	await act(async () => {
		root.render(React.createElement(mod.ThinkingDock, {
			sessionId: "s1",
			inputState,
			selectionStore,
			sessionStore,
			statsStore,
			usageStore,
			pressureStore,
			outlineStore,
			project: "baby_app",
			loadCatalog: async () => catalog,
			createSession,
			select: async () => ({ ok: true })
		}));
		await Promise.resolve();
	});
	return { root, inputState, statsStore, sessionStore, usageStore };
}

// fixture 严格对齐宿主 tokenUsage 投影的严格四桶 schema（无 totalTokens；总量为四桶之和 224000）
const usage = { uncachedInputTokens: 80000, cacheReadTokens: 120000, cacheWriteTokens: 14000, outputTokens: 10000 };
// fixture 严格对齐宿主 contextPressure 投影：当前上下文 400k / 容量 1M = 40%
const pressure = { surfaceTokens: 400000, contextWindow: 1000000, pressureTokens: 400000 };

// 1. 超过轮次阈值：显示会话卡，带缓存感知指标
let view = await render({ usage, pressure });
let notice = container.querySelector("[data-session-notice]");
assert.ok(notice, "should render the session notice");
let text = notice.textContent.replace(/\s+/g, " ").trim();
assert.ok(text.includes("32 轮"), `expected turn count, got: ${text}`);
assert.ok(text.includes("224k tokens"), `expected total tokens, got: ${text}`);
assert.ok(text.includes("缓存命中 56%"), `expected cache hit, got: ${text}`);
assert.ok(text.includes("当前上下文 400k"), `expected context size, got: ${text}`);
assert.ok(text.includes("占上下文 40%"), `expected context ratio, got: ${text}`);
assert.ok(!text.includes("估算计费"), `estimated cost must be gone, got: ${text}`);

// 1.5 低于阈值：24 轮 / 上下文 40% 不提醒
await act(async () => { view.root.unmount(); });
view = await render({ turns: 24, usage, pressure });
assert.equal(container.querySelector("[data-session-notice]"), null, "24 turns / 40% context must stay quiet");

// 1.6 轮次边界：25 轮即提醒
await act(async () => { view.root.unmount(); });
view = await render({ turns: 25, usage, pressure });
assert.ok(container.querySelector("[data-session-notice]"), "25 turns must show the session notice");

// 1.7 上下文边界：轮次不足但上下文占容量达 60% 即提醒；差 1% 不提醒
await act(async () => { view.root.unmount(); });
view = await render({ turns: 10, usage, pressure: { surfaceTokens: 600000, contextWindow: 1000000, pressureTokens: 600000 } });
assert.ok(container.querySelector("[data-session-notice]"), "60% context must show the session notice");
await act(async () => { view.root.unmount(); });
view = await render({ turns: 10, usage, pressure: { surfaceTokens: 590000, contextWindow: 1000000, pressureTokens: 590000 } });
assert.equal(container.querySelector("[data-session-notice]"), null, "59% context must stay quiet");

// 1.8 累计 token 再多也不该触发：触发看当前上下文，不看累计消耗
await act(async () => { view.root.unmount(); });
view = await render({ turns: 10, usage: { uncachedInputTokens: 500000000, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }, pressure });
assert.equal(container.querySelector("[data-session-notice]"), null, "large cumulative total alone must not trigger");

// 2. 新建会话：加载态 → 恢复
let resolveCreate;
const createSession = () => new Promise((resolve) => { resolveCreate = resolve; });
await act(async () => { view.root.unmount(); });
view = await render({ usage, createSession });
let openButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "新建会话");
assert.ok(openButton, "should have a new-session button");
await act(async () => {
	openButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
	await Promise.resolve();
});
openButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "新建中…");
assert.ok(openButton && openButton.disabled, "button must show loading and be disabled");
await act(async () => { resolveCreate("s2"); await Promise.resolve(); await Promise.resolve(); });
assert.ok([...container.querySelectorAll("button")].some((button) => button.textContent === "新建会话"), "button must recover after create");

// 3. 忽略：本会话不再显示
let dismissButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "本会话不再提醒");
assert.ok(dismissButton, "should have a dismiss button");
await act(async () => {
	dismissButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
	await Promise.resolve();
});
assert.equal(container.querySelector("[data-session-notice]"), null, "dismiss must hide the session notice");

// 4. 子代理会话不显示
await act(async () => { view.root.unmount(); });
view = await render({ usage, pressure, subagent: { address: { mode: "continuable" }, parentAvailable: true } });
assert.equal(container.querySelector("[data-session-notice]"), null, "subagent sessions must not show the session notice");

// 4.1 同一任务还没结束：既提新开会话，也提压缩历史，并写清 /compact 的正确用法
//     （输入框按 / 打开指令列表再选 Compact，不是直接敲 /compact 发送）
await act(async () => { view.root.unmount(); });
view = await render({
	usage,
	pressure,
	outline: [
		{ prompt: "帮我排查这个崩溃的根因", response: "堆栈在这里" },
		{ prompt: "继续看", response: "好的" }
	]
});
text = container.querySelector("[data-session-notice]").textContent.replace(/\s+/g, " ").trim();
assert.ok(text.includes("还没结束"), `ongoing task must say the task is unfinished, got: ${text}`);
assert.ok(text.includes("新开会话"), `ongoing task must offer a new session, got: ${text}`);
assert.ok(text.includes("Compact"), `ongoing task must offer compaction, got: ${text}`);
assert.ok(text.includes("按 /"), `compaction hint must state how to invoke it, got: ${text}`);

// 4.2 明确换了话题：直接劝新开会话，不提压缩
await act(async () => { view.root.unmount(); });
view = await render({
	usage,
	pressure,
	outline: [
		{ prompt: "帮我排查这个崩溃的根因", response: "堆栈在这里" },
		{ prompt: "另外，我们来做个新插件", response: "好" }
	]
});
text = container.querySelector("[data-session-notice]").textContent.replace(/\s+/g, " ").trim();
assert.ok(!text.includes("Compact"), `a new topic must not suggest compaction, got: ${text}`);
assert.ok(text.includes("换个话题"), `a new topic should suggest a new session, got: ${text}`);

// 5. 有草稿时不抢档位卡的位置
await act(async () => { view.root.unmount(); });
view = await render({ usage, draft: "重构同步模块，排查并发写入时数据丢失的根因" });
assert.equal(container.querySelector("[data-session-notice]"), null, "drafting must yield to the level card");

console.log("ok: session notice, cache-aware metrics, create loading, dismiss, subagent skip");
