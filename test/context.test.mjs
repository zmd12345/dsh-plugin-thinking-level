import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

// 依赖缺失时跳过：仓库测试保持零依赖，这条只在装了 react/react-dom/jsdom 的环境跑。
let React;
let ReactDOMClient;
let act;
let JSDOM;
try {
	React = (await import("react")).default;
	ReactDOMClient = await import("react-dom/client");
	act = (await import("react-dom/test-utils")).act;
	JSDOM = (await import("jsdom")).JSDOM;
} catch (_error) {
	console.log("skip: 需要 react / react-dom / jsdom 才能跑上下文用例");
	process.exit(0);
}

const clientPath = fileURLToPath(new URL("../lib/client.js", import.meta.url));
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
let definition = null;
dom.window.__ModuleLoader__ = { load(value) { definition = value; } };
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vm.runInNewContext(readFileSync(clientPath, "utf8"), {
	window: dom.window,
	document: dom.window.document,
	console,
	setTimeout,
	clearTimeout
}, { filename: "lib/client.js" });

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
	default: { provider: "p", model: "m", reasoningEffort: "medium" },
	groups: [{ id: "p", models: [{ id: "m", reasoning: { defaultEffort: "medium", efforts: [{ id: "low", name: "低" }, { id: "medium", name: "中" }, { id: "high", name: "高" }] } }] }]
};

const inputState = store({ draft: "", phase: "plain", attachmentIds: [], draftRev: 0 });
const selectionStore = store({ next: { provider: "p", model: "m", reasoningEffort: "medium" } });
const sessionStore = store({ blank: true, subagent: null, running: false });

const root = ReactDOMClient.createRoot(document.getElementById("root"));
await act(async () => {
	root.render(React.createElement(mod.ThinkingDock, {
		sessionId: "s1",
		inputState,
		selectionStore,
		sessionStore,
		loadCatalog: async () => catalog,
		select: async () => ({ ok: true })
	}));
	await Promise.resolve();
});

const banner = () => document.querySelector("[data-thinking-level]");
const type = async (text) => {
	await act(async () => {
		inputState.set({ draft: text, phase: "plain", attachmentIds: [], draftRev: inputState.getSnapshot().draftRev + 1 });
		await Promise.resolve();
	});
};

const HEAVY = "重构同步模块，排查并发写入时数据丢失的根因，并补测试";

// 1. 纯陈述不是请求：沉默
await type("今天宝宝体检完了，体重 8.2kg，医生说很正常");
assert.equal(banner(), null, "纯陈述不应该提醒");

// 2. 新会话里的重任务：提醒
await type(HEAVY);
assert.ok(banner() && banner().getAttribute("data-thinking-level") === "high", "重任务应该提醒升档");

// 3. 追问里的中等任务：沉默
sessionStore.set({ blank: false, subagent: null, running: true });
await type("更新一下接口文档，顺便检查另外两端");
assert.equal(banner(), null, "中等追问不应该打扰");

// 4. 追问里的重任务：仍然提醒
await type(HEAVY);
assert.ok(banner(), "重任务的追问仍然要提醒");

// 5. 子代理会话：完全不出现
sessionStore.set({ blank: false, subagent: { address: { mode: "continuable" }, parentAvailable: true }, running: true });
await type("");
await type(HEAVY);
assert.equal(banner(), null, "子代理会话不显示提醒");

console.log("ok: 陈述沉默、追问闸门、子代理跳过");
