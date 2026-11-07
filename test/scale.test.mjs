import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
let JSDOM;
try { ({ JSDOM } = await import("jsdom")); } catch (_error) {
	console.log("skip: 需要 react / react-dom / jsdom 才能跑档位映射用例");
	process.exit(0);
}

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
let definition = null;
dom.window.__ModuleLoader__ = { load(value) { definition = value; } };
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vm.runInNewContext(readFileSync(new URL("../lib/client.js", import.meta.url), "utf8"), {
	window: dom.window, document: dom.window.document, console, setTimeout, clearTimeout
}, { filename: "client.js" });

const React = (await import("react")).default;
const ReactDOMClient = await import("react-dom/client");
const { act } = await import("react-dom/test-utils");
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

const HEAVY = "重构同步模块，排查并发写入时数据丢失的根因，并补测试";
const container = document.getElementById("root");

async function renderWith(reasoning, currentEffort) {
	const inputState = store({ draft: "", phase: "plain", attachmentIds: [], draftRev: 0 });
	const selectionStore = store({ next: { provider: "p", model: "m", ...(currentEffort ? { reasoningEffort: currentEffort } : {}) } });
	const sessionStore = store({ blank: true, subagent: null, running: false });
	const catalog = {
		default: { provider: "p", model: "m" },
		groups: [{ id: "p", models: [{ id: "m", ...(reasoning ? { reasoning } : {}) }] }]
	};
	container.innerHTML = "";
	const root = ReactDOMClient.createRoot(container);
	await act(async () => {
		root.render(React.createElement(mod.ThinkingDock, {
			sessionId: "s1", inputState, selectionStore, sessionStore,
			loadCatalog: async () => catalog,
			select: async () => ({ ok: true })
		}));
		await Promise.resolve();
	});
	await act(async () => {
		inputState.set({ draft: HEAVY, phase: "plain", attachmentIds: [], draftRev: 1 });
		await Promise.resolve();
	});
	await act(async () => { await Promise.resolve(); });
	const banner = container.querySelector("[data-thinking-level]");
	const text = banner ? banner.textContent.replace(/\s+/g, " ").trim() : null;
	const buttons = banner ? [...banner.querySelectorAll("button")].map((b) => b.textContent) : [];
	await act(async () => { root.unmount(); });
	return { text, buttons };
}

// 1. 模型没有推理等级：完全不提醒
assert.deepEqual(await renderWith(null, null), { text: null, buttons: [] }, "no reasoning metadata must stay silent");

// 2. 只有一个固定等级：没有可切换的档位
assert.deepEqual(
	await renderWith({ defaultEffort: "fixed", efforts: [{ id: "fixed", name: "Fixed" }] }, "fixed"),
	{ text: null, buttons: [] },
	"single fixed effort must stay silent"
);

// 3. 两档模型：用模型自己的标签
const binary = await renderWith({ defaultEffort: "low", efforts: [{ id: "low", name: "Low" }, { id: "high", name: "High" }] }, "low");
assert.ok(binary.text.includes("「High」"), `binary scale should suggest High, got: ${binary.text}`);
assert.ok(binary.buttons.includes("切到High"), `binary scale button, got: ${binary.buttons.join("/")}`);

// 4. 六档模型有 high：精确命中 High，而不是最高档 Max
const six = await renderWith({
	defaultEffort: "low",
	efforts: [{ id: "minimal", name: "Minimal" }, { id: "low", name: "Low" }, { id: "medium", name: "Medium" }, { id: "high", name: "High" }, { id: "xhigh", name: "Xhigh" }, { id: "max", name: "Max" }]
}, "low");
assert.ok(six.text.includes("「High」") && !six.text.includes("「Max」"), `six-level must hit High, got: ${six.text}`);

// 5. 没有 high 的五档模型：落到次高档 Xhigh，而不是凭空造一个 High
const five = await renderWith({
	defaultEffort: "low",
	efforts: [{ id: "minimal", name: "Minimal" }, { id: "low", name: "Low" }, { id: "medium", name: "Medium" }, { id: "xhigh", name: "Xhigh" }, { id: "max", name: "Max" }]
}, "low");
assert.ok(five.text.includes("「Xhigh」"), `five-level without high should map to Xhigh, got: ${five.text}`);

console.log("ok: no-scale silence, single-effort silence, model-specific labels");
