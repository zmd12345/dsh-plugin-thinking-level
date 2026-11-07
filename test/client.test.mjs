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
	["这是什么意思？", "low"],
	["继续", null],
	["重构同步模块，排查并发写入时数据丢失的根因，并补测试", "high"],
	["把这段文字翻译成英文", "low"]
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

console.log(`ok: ${cases.length} draft cases + ${followUpCases.length} follow-up cases, bundle exports valid`);
