import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

let definition = null;
const sandbox = {
	window: {
		__ModuleLoader__: {
			load(value) { definition = value; }
		}
	},
	console
};
vm.runInNewContext(source, sandbox, { filename: "lib/client.js" });

assert.ok(definition, "client bundle must call window.__ModuleLoader__.load");
assert.equal(definition.id, "dsh-plugin-thinking-level");

const reactStub = {
	createElement() { return null; },
	useState() { return [null, () => {}]; },
	useEffect() {},
	useSyncExternalStore() { return null; },
	useCallback(fn) { return fn; },
	useMemo(fn) { return fn(); }
};
const mod = definition.factory((id) => {
	if (id === "react") return reactStub;
	throw new Error(`unexpected require: ${id}`);
});

assert.equal(typeof mod.apply, "function");
assert.deepEqual(Array.from(mod.inject), ["slots", "sessions", "conversation", "remote", "remote.session"]);

const cases = [
	["", null],
	["/plan 重构同步模块", null],
	["你好", null],
	["帮我改一下按钮颜色", "low"],
	["把这段文字翻译成英文", "low"],
	["列出当前目录下的文件", "low"],
	["检查一下登录接口为什么返回 401", "medium"],
	["重构同步模块，排查并发写入时数据丢失的根因，并补测试", "high"],
	["你帮我做一个插件：自动评估当前的任务需要选择哪个档位的思考程度，然后对我进行提醒", "high"],
	["```\nTraceback (most recent call last):\n  File \"app.py\", line 3\nValueError: bad value\n```\n为什么启动就崩？帮我看下根因", "high"],
	// 纯陈述，不是请求：一律沉默
	["今天宝宝体检完了，体重 8.2kg，医生说很正常", null],
	["刚才安卓端构建失败了", null],
	["我发现这个提示有时候会重复弹出来", null],
	["我觉得这个按钮颜色有点深", null],
	["昨天服务端重启过，日志里能看到", null],
	// 陈述 + 请求：才给建议
	["刚才安卓端构建失败了，帮我看下日志什么原因", "medium"],
	// 项目上下文：三端同仓，动一端要同步另外两端
	["安卓端登录页文案改一下", "medium"]
];

const followUpCases = [
	["更新一下接口文档", null],
	["这是什么意思？", null],
	["继续", null],
	["重构同步模块，排查并发写入时数据丢失的根因，并补测试", "high"],
	["把这段文字翻译成英文", null]
];

for (const [input, expected] of cases) {
	const result = mod.analyzeTask(input);
	const actual = result === null ? null : result.level;
	assert.equal(actual, expected, `${JSON.stringify(input)} => ${actual}, expected ${expected}; score=${result && result.score}; reasons=${result && result.reasons.join("/")}`);
	if (result !== null) {
		assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0, "reasons must be present");
		assert.ok(result.score >= 0 && result.score <= 9, "score must be bounded");
	}
}

for (const [input, expected] of followUpCases) {
	const result = mod.analyzeTask(input, { followUp: true });
	const actual = result === null ? null : result.level;
	assert.equal(actual, expected, `followUp ${JSON.stringify(input)} => ${actual}, expected ${expected}; score=${result && result.score}`);
}

// 历史上下文：同一任务继续、换任务、项目规则、稳定性补漏
const historyCases = [
	{
		input: "把登录页文案改一下",
		opts: { followUp: true, history: ["安卓端登录页文案改一下", "鸿蒙端同步一下"], project: "baby_app" },
		expected: null,
		why: "同一任务的小改动不重新定档"
	},
	{
		input: "重构同步模块，排查并发写入时数据丢失的根因，并补测试",
		opts: { followUp: true, history: ["重构同步模块", "排查并发写入"] },
		expected: "high",
		why: "追问里出现新的高复杂度信号仍然提醒"
	},
	{
		input: "另外把设置页的开关也改一下",
		opts: { followUp: true, history: ["重构同步模块"] },
		expected: "low",
		why: "明确换任务时按新任务评估"
	},
	{
		input: "帮我看看线上偶尔接口 500、数据不一致的问题",
		opts: { followUp: false, history: [] },
		expected: "high",
		why: "线上/稳定性信号补漏"
	}
];

for (const item of historyCases) {
	const result = mod.analyzeTask(item.input, item.opts);
	const actual = result === null ? null : result.level;
	assert.equal(actual, item.expected, `${item.why}: ${JSON.stringify(item.input)} => ${actual}, expected ${item.expected}; score=${result && result.score}; reasons=${result && result.reasons.join("/")}`);
}

// 会话指标：轮次 + 缓存命中 + 当前上下文占容量的比例
// （fixture 严格对齐宿主 tokenUsage 四桶 schema，无 totalTokens 字段）
const m1 = mod.sessionMetrics({ turns: 32 }, { uncachedInputTokens: 80000, cacheReadTokens: 120000, cacheWriteTokens: 14000, outputTokens: 10000 });
assert.equal(m1.turns, 32);
assert.equal(m1.totalTokens, 224000, "总量应为四桶之和");
assert.ok(m1.cacheHit > 0.55 && m1.cacheHit < 0.57, `cacheHit=${m1.cacheHit}`);

// 当前上下文取自 contextPressure 投影：provider 报告的 prompt 大小与路由容量
const p1 = mod.sessionMetrics({ turns: 32 }, { uncachedInputTokens: 80000, cacheReadTokens: 120000, cacheWriteTokens: 14000, outputTokens: 10000 }, { surfaceTokens: 900000, contextWindow: 1000000, pressureTokens: 920000 });
assert.equal(p1.contextTokens, 920000, "当前上下文应取 pressureTokens");
assert.equal(p1.contextWindow, 1000000);
assert.ok(Math.abs(p1.contextRatio - 0.92) < 1e-9, `contextRatio=${p1.contextRatio}`);

// 没有 provider 样本时退回 surface 估计
const p2 = mod.sessionMetrics({ turns: 10 }, { uncachedInputTokens: 20000, cacheReadTokens: 170000, cacheWriteTokens: 5000, outputTokens: 5000 }, { surfaceTokens: 300000, contextWindow: 1000000 });
assert.equal(p2.contextTokens, 300000, "无 pressureTokens 时应退回 surfaceTokens");
assert.ok(Math.abs(p2.contextRatio - 0.3) < 1e-9, `contextRatio=${p2.contextRatio}`);

// 老宿主没有 contextPressure 投影时安全降级：比例未知，不误触发
const p3 = mod.sessionMetrics({ turns: 10 }, { uncachedInputTokens: 20000, cacheReadTokens: 170000, cacheWriteTokens: 5000, outputTokens: 5000 }, null);
assert.equal(p3.contextRatio, null, "无 pressure 投影时比例应为 null");
assert.equal(p3.contextTokens, null);

// 新会话（usage 缺失）总量应为 null，而不是 0
assert.equal(mod.sessionMetrics({ turns: 0 }, null).totalTokens, null);

// 同任务是否仍在进行：看最近几轮的强信号，且没有换题迹象
const T = (prompt, response) => ({ prompt, response });
assert.equal(mod.taskStillOngoing([T("帮我排查这个崩溃问题", "堆栈如下"), T("继续看", "好的")]), true, "未完的排查任务应判定为仍在进行");
assert.equal(mod.taskStillOngoing([T("帮我排查这个崩溃问题", "堆栈如下"), T("另外，我们来做个新插件", "好")]), false, "明确换题应判定为已结束");
assert.equal(mod.taskStillOngoing([T("翻译这段话", "好的")]), false, "简单任务不算未完成");
assert.equal(mod.taskStillOngoing([]), false, "无历史时不算未完成");
assert.equal(mod.taskStillOngoing([T("帮我排查崩溃", "好的"), T("继续", "继续看")]), true, "追问继续仍是同一任务");

assert.equal(mod.formatCount(214000), "214k");
assert.equal(mod.formatCount(1500000), "1.5M");
assert.equal(mod.formatCount(950), "950");

// 新建会话：优先走 uiWorkspace.connectWorkspace(workspaceId)，而不是 sessions.create({directory})
const wsCalls = [];
const mockWorkspace = {
	workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: "w-baby", sessionIds: ["s1"] }] }) } },
	connectWorkspace: async (id, opts) => { wsCalls.push(["connect", id, opts]); return "s2"; },
	openSession: (id) => { wsCalls.push(["open", id]); }
};
const blockedSessions = { create: async () => { throw new Error("must not fall back to sessions.create"); } };
const newId = await mod.createSessionIn(mockWorkspace, blockedSessions, "s1", "/Volumes/work/baby_app");
assert.equal(newId, "s2");
assert.equal(JSON.stringify(wsCalls), JSON.stringify([["connect", "w-baby", {}], ["open", "s2"]]));

// 兜底：找不到工作区时用 cwd（不是 directory）
const fallbackCalls = [];
const noWorkspace = {
	workspaces: { list: { getSnapshot: () => ({ items: [] }) } },
	openSession: (id) => { fallbackCalls.push(["open", id]); }
};
const fallbackSessions = { create: async (opts) => { fallbackCalls.push(["create", opts]); return "s3"; } };
const fallbackId = await mod.createSessionIn(noWorkspace, fallbackSessions, "s1", "/Volumes/work/baby_app");
assert.equal(fallbackId, "s3");
assert.equal(JSON.stringify(fallbackCalls), JSON.stringify([["create", { cwd: "/Volumes/work/baby_app" }], ["open", "s3"]]));

console.log(`ok: ${cases.length} draft + ${followUpCases.length} follow-up + ${historyCases.length} history cases, metrics valid`);
