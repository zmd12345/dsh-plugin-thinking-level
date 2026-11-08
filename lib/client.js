window.__ModuleLoader__.load({
	id: "dsh-plugin-thinking-level",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		const React = require("react");
		const h = React.createElement;

		/** 仅用于把当前/建议档位映射到 catalog 的实际顺序。 */
		const LEVEL_ORDER = ["low", "medium", "high", "max"];

		const HIGH_WORDS = [
			"架构", "重构", "排查", "调试", "根因", "并发", "性能", "安全", "迁移", "跨端",
			"协议", "算法", "实现", "开发", "插件", "集成", "兼容", "崩溃", "闪退", "内存泄漏",
			"死锁", "事务", "索引", "部署", "评审", "取舍", "测试失败", "报错", "异常",
			"数据丢失", "数据不一致", "状态同步", "生命周期", "多端", "三端"
		];
		const MEDIUM_WORDS = [
			"修改", "新增", "更新", "修复", "测试", "检查", "对比", "生成", "整理", "文档",
			"脚本", "页面", "接口", "字段", "样式", "布局", "交互", "流程", "配置", "安装",
			"升级", "替换", "补全", "梳理", "分析", "设计", "优化", "方案", "说明", "解释",
			"示例", "总结", "评估", "校准", "验证", "失败", "日志", "原因"
		];
		const SIMPLE_WORDS = [
			"翻译", "格式化", "改名", "文案", "列出", "是什么", "确认", "删除",
			"打开", "复制", "粘贴", "截图", "颜色", "字体", "拼写", "错别字", "一句话",
			"简单", "快速", "只需要", "只需", "不用改"
		];
		const STEP_WORDS = ["然后", "接着", "最后", "首先", "其次", "并且", "同时", "分别", "再"];
		const CONSTRAINT_WORDS = ["必须", "不要", "禁止", "务必", "不能", "需要保证", "不能破坏"];
		const STABILITY_WORDS = [
			"偶尔", "间歇", "随机", "概率", "复现", "线上", "生产", "超时", "卡死", "变慢",
			"内存", "泄漏", "数据不对", "数据不一致", "丢了", "重复", "错乱"
		];

		/** 只有「让我做事」才提醒；纯陈述、纯描述一律沉默。 */
		const REQUEST_MARKERS = [
			"帮我", "请你", "请", "麻烦", "能不能", "能否", "可以", "你来", "你帮", "看下", "看看", "查下", "查查",
			"实现", "生成", "创建", "发布", "安装", "部署", "迁移", "重构", "排查", "调试", "分析", "评估", "设计",
			"优化", "梳理", "总结", "翻译", "解释", "验证", "测试", "对比", "建议", "提醒", "判断", "选择", "配置",
			"改一下", "改下", "改成", "换成", "修一下", "修下", "修复", "加个", "加上", "补上", "补充", "更新", "新增", "删除",
			"为什么", "怎么办", "如何", "怎样", "是不是", "有没有", "是否", "什么意思", "列一下", "列出", "跑一下", "运行"
		];
		const REQUEST_LEADING = /^(帮我|请|麻烦|把|给|来|做|写|改|修|加|删|查|看|实|生|创|发|安|部|迁|重|排|调|分|评|设|优|梳|总|翻|解|验|测|对|建|提|判|选|配|更|新|补|你|能|可)/u;

		/** 项目上下文：本工作区是三端同仓，动一端常要同步另外两端。 */
		const PLATFORM_WORDS = ["安卓", "鸿蒙", "ios", "android", "flutter", "arkts", "swiftui", "三端", "双端", "跨端", "客户端", "服务端"];
		const PLATFORM_CHANGE = /(改|修|加|删|同步|更新|发布|配置|迁移|实现|重构|补)/u;

		/**
		 * 本地启发式评估：零网络、零延迟，只根据输入文本 + 会话上下文给出建议档位。
		 * 两道闸门压掉误报：先要求这句话是「请求」而不是「陈述」，
		 * 再要求会话里的追问足够重才打扰——用户接着聊时多半不需要重新定档。
		 *
		 * @param {string} raw 输入框纯文本
		 * @param {{followUp?: boolean}} [opts] followUp = 当前会话已有历史轮次
		 * @returns {{level: 'low'|'medium'|'high', score: number, reasons: string[], hits: object}|null}
		 */
		function analyzeTask(raw, opts) {
			const followUp = Boolean(opts && opts.followUp);
			const history = Array.isArray(opts && opts.history)
				? opts.history.filter((item) => typeof item === "string" && item.trim() !== "")
				: [];
			const project = opts && typeof opts.project === "string" ? opts.project : null;
			const text = String(raw == null ? "" : raw).replace(/\r\n?/gu, "\n").trim();
			if (text === "" || text.startsWith("/")) return null;
			if (text.length < 6) return null;

			const lower = text.toLowerCase();
			const historyText = history.join("\n").toLowerCase();
			const asksSomething = REQUEST_MARKERS.some((word) => lower.includes(word.toLowerCase()))
				|| /[？?]$/u.test(text)
				|| REQUEST_LEADING.test(text);
			if (!asksSomething) return null;

			const hitsOf = (words, haystack) => {
				const found = [];
				for (const word of words) {
					const needle = word.toLowerCase();
					if (haystack.includes(needle) && !found.includes(word)) found.push(word);
				}
				return found;
			};

			const reasons = [];
			let score = 2;
			const highHits = hitsOf(HIGH_WORDS, lower);
			const mediumHits = hitsOf(MEDIUM_WORDS, lower);
			const simpleHits = hitsOf(SIMPLE_WORDS, lower);
			const stepHits = hitsOf(STEP_WORDS, lower);
			const constraintHits = hitsOf(CONSTRAINT_WORDS, lower);
			const historyHigh = hitsOf(HIGH_WORDS, historyText);
			const historySignals = [
				...historyHigh,
				...hitsOf(MEDIUM_WORDS, historyText),
				...hitsOf(PLATFORM_WORDS, historyText)
			];
			const platformInDraft = hitsOf(PLATFORM_WORDS, lower);
			const platformInHistory = hitsOf(PLATFORM_WORDS, historyText);

			// 同一任务里的追问：没有新信号、没有扩范围时，不重新定档。
			const newTask = /(另外|换个|换一个|新任务|还有一件事|说个别的|下一个任务|重新开始|我们来做)/u.test(text);
			const expansion = /(还要|再加|再加上|顺便|同时|另外|补上|补充|扩展|一起)/u.test(text);
			const sharedSignals = [...highHits, ...mediumHits, ...platformInDraft].filter((word) => historySignals.includes(word));
			const newHighSignals = highHits.filter((word) => !historyHigh.includes(word));
			const sameTopic = sharedSignals.length > 0;
			const continuation = followUp && !newTask && sameTopic && newHighSignals.length === 0 && !expansion;

			if (highHits.length > 0) {
				score += highHits.length >= 2 ? 4 : 3;
				reasons.push(`涉及${highHits.slice(0, 3).join("、")}`);
			}
			if (mediumHits.length > 0) {
				score += Math.min(2, mediumHits.length);
				if (highHits.length === 0) reasons.push(`需要${mediumHits.slice(0, 2).join("、")}`);
			}

			const stabilityHits = hitsOf(STABILITY_WORDS, lower);
			if (stabilityHits.length > 0) {
				score += 2;
				reasons.push("涉及线上/稳定性问题");
			}
			if (/\b[45]\d\d\b/u.test(text) && /(接口|请求|返回|响应)/u.test(text)) score += 1;

			const projectPlatform = platformInDraft.length > 0
				? platformInDraft
				: project === "baby_app" ? platformInHistory : [];
			const crossPlatform = projectPlatform.length > 0 && PLATFORM_CHANGE.test(text);
			if (crossPlatform) {
				score += 2;
				reasons.push(project === "baby_app" ? "当前项目三端同仓" : "涉及三端口径同步");
			} else if (simpleHits.length > 0) {
				score -= Math.min(3, 1 + simpleHits.length);
				reasons.push("看起来是简单直接的任务");
			}

			if (text.length <= 12) score -= 1;
			else if (text.length >= 500) {
				score += 3;
				reasons.push("需求描述很长");
			} else if (text.length >= 200) {
				score += 2;
				reasons.push("需求描述较长");
			} else if (text.length >= 80) {
				score += 1;
			}

			const hasCode = /```|`[^`\n]+`/u.test(text);
			if (hasCode) {
				score += 2;
				reasons.push("包含代码片段");
			}

			const hasStack = /(traceback|exception|\bat\s+[\w.$]+\(|error:|\bE[A-Z]{3,}\b)/iu.test(text);
			if (hasStack) {
				score += 2;
				reasons.push("包含报错或堆栈");
			}

			const fileMatches = text.match(/\b[\w./-]+\.(?:dart|tsx?|jsx?|swift|ets|json|ya?ml|md|py|go|java|kt|sh|css|html)\b/giu) || [];
			if (fileMatches.length >= 2) {
				score += 2;
				reasons.push("涉及多个文件");
			} else if (fileMatches.length === 1) {
				score += 1;
			}

			if (stepHits.length >= 2) {
				score += 2;
				reasons.push("包含多步操作");
			} else if (stepHits.length === 1) {
				score += 1;
			}

			if ((text.match(/[？?]/gu) || []).length >= 2) score += 1;
			if (constraintHits.length >= 2) score += 1;

			score = Math.max(0, Math.min(9, score));
			const level = score >= 7 ? "high" : score >= 3 ? "medium" : "low";

			if (followUp && !newTask) {
				if (continuation) {
					// 同一任务继续：只有非常明确的升档才打扰。
					if (score < 8) return null;
				} else if (score < 7) {
					// 非新任务的追问不提示降档，避免一句话把长任务误判成简单任务。
					return null;
				}
			}

			if (reasons.length === 0) reasons.push(level === "low" ? "任务比较直接" : "任务信息量一般");

			return {
				level,
				score,
				reasons: Array.from(new Set(reasons)).slice(0, 3),
				hits: { high: highHits, medium: mediumHits, simple: simpleHits },
				context: { followUp, sameTopic, continuation, newTask, project }
			};
		}
		const EMPTY_STORE = {
			subscribe() { return () => {}; },
			getSnapshot() { return null; }
		};

		let catalogCache = null;
		let catalogInflight = null;
		const CATALOG_TTL = 60 * 1000;

		/** 读取 Host 的模型目录（含每个模型的推理等级）。失败时返回 null，不阻塞提醒。 */
		function loadCatalog(ctx) {
			const now = Date.now();
			if (catalogCache !== null && now - catalogCache.at < CATALOG_TTL) return Promise.resolve(catalogCache.value);
			if (catalogInflight !== null) return catalogInflight;

			let remoteSession;
			try {
				remoteSession = ctx.remote && ctx.remote.session;
			} catch (_error) {}
			if ((remoteSession === undefined || remoteSession === null) && typeof ctx.get === "function") {
				try {
					remoteSession = ctx.get("remote.session");
				} catch (_error) {}
			}
			if (remoteSession === undefined || remoteSession === null || typeof remoteSession.modelCatalog !== "function") {
				return Promise.resolve(null);
			}

			catalogInflight = remoteSession.modelCatalog().then((response) => {
				if (response === undefined || response === null || response.ok !== true) {
					throw new Error(response && response.error ? `${response.error.code}: ${response.error.message}` : "modelCatalog 失败");
				}
				catalogCache = { at: Date.now(), value: response.value };
				return response.value;
			}).catch(() => null).finally(() => {
				catalogInflight = null;
			});
			return catalogInflight;
		}

		function reasoningFor(catalog, provider, model) {
			const groups = catalog && Array.isArray(catalog.groups) ? catalog.groups : [];
			for (const group of groups) {
				if (group.id !== provider) continue;
				const models = Array.isArray(group.models) ? group.models : [];
				for (const item of models) {
					if (item.id === model) return item.reasoning || null;
				}
			}
			return null;
		}

		function normalizeEfforts(reasoning) {
			const raw = reasoning && Array.isArray(reasoning.efforts) ? reasoning.efforts : [];
			const efforts = raw.filter((item) => item && typeof item.id === "string" && item.id !== "");
			return efforts.length > 0 ? efforts : null;
		}

		function effortIndex(efforts, id) {
			if (id === undefined || id === null || id === "") return null;
			const needle = String(id).toLowerCase();
			const exact = efforts.findIndex((item) => String(item.id).toLowerCase() === needle);
			if (exact >= 0) return exact;
			const rank = LEVEL_ORDER.indexOf(needle);
			if (rank >= 0) return Math.min(rank, efforts.length - 1);
			return null;
		}

		/**
		 * 把建议映射到模型真实存在的档位。不同模型的命名不统一
		 * （low/medium/high、minimal/low/medium/xhigh/max…），所以先按 id 精确匹配，
		 * 再按语义锚点落位；绝不凭空生成一个模型没有的档位。
		 */
		function chooseEffort(efforts, level) {
			if (!Array.isArray(efforts) || efforts.length < 2) return null;
			const byId = (needle) => efforts.find((item) => String(item.id).toLowerCase() === needle);
			const exact = byId(level);
			if (exact !== undefined) return exact;
			if (level === "low") return efforts[0];
			if (level === "medium") return efforts[Math.floor((efforts.length - 1) / 2)];
			if (level === "high") {
				// 三档模型（Low/Medium/Xhigh）没有 high，下一档就是最高档；
				// 四档以上才给最高档留位置，避免把 high 顶成 max。
				return efforts.length <= 3 ? efforts[efforts.length - 1] : efforts[efforts.length - 2];
			}
			return efforts[efforts.length - 1];
		}

		function currentSelectionOf(catalog, projected) {
			if (projected !== null && projected !== undefined) {
				const selected = projected.next || projected.lastUsed;
				if (selected !== null && selected !== undefined) return selected;
			}
			return catalog && catalog.default ? catalog.default : null;
		}

		function workspaceForSession(uiWorkspace, sessionId) {
			try {
				const listed = uiWorkspace && uiWorkspace.workspaces && uiWorkspace.workspaces.list
					? uiWorkspace.workspaces.list.getSnapshot()
					: null;
				if (!listed || !Array.isArray(listed.items)) return null;
				return listed.items.find((item) => Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId)) || null;
			} catch (_error) {
				return null;
			}
		}

		async function createSessionIn(uiWorkspace, sessions, sessionId, cwd) {
			const workspace = workspaceForSession(uiWorkspace, sessionId);
			// 官方新建路径按 workspaceId 创建并更新工作区树；只传 cwd 会建出
			// 会话但 UI 仍显示“选择工作区”。
			if (workspace && uiWorkspace && typeof uiWorkspace.connectWorkspace === "function") {
				const id = await uiWorkspace.connectWorkspace(workspace.workspaceId, {});
				if (typeof uiWorkspace.openSession === "function") uiWorkspace.openSession(id);
				return id;
			}
			const id = await sessions.create(cwd ? { cwd } : {});
			if (uiWorkspace && typeof uiWorkspace.openSession === "function") uiWorkspace.openSession(id);
			return id;
		}

		function safeFace(projections, name) {
			try {
				return projections && typeof projections.faceOf === "function" ? projections.faceOf(name) : null;
			} catch (_error) {
				return null;
			}
		}

		const SESSION_TURN_LIMIT = 25;
		const SESSION_EFFECTIVE_TOKEN_LIMIT = 100000;
		// 缓存读取按约 1/10 单价估算，避免命中率高时 token 数虚高导致误判。
		const CACHE_READ_COST = 0.1;

		function sessionMetrics(stats, usage) {
			const turns = stats && Number.isFinite(stats.turns) ? stats.turns : null;
			const totalTokens = usage && Number.isFinite(usage.totalTokens) ? usage.totalTokens : null;
			const uncached = usage && Number.isFinite(usage.uncachedInputTokens) ? usage.uncachedInputTokens : 0;
			const cacheRead = usage && Number.isFinite(usage.cacheReadTokens) ? usage.cacheReadTokens : 0;
			const cacheWrite = usage && Number.isFinite(usage.cacheWriteTokens) ? usage.cacheWriteTokens : 0;
			const output = usage && Number.isFinite(usage.outputTokens) ? usage.outputTokens : 0;
			const billed = uncached + cacheRead + cacheWrite;
			const cacheHit = billed > 0 ? cacheRead / billed : null;
			const effective = Math.round(uncached + cacheWrite + output + cacheRead * CACHE_READ_COST);
			return { turns, totalTokens, cacheHit, effective };
		}

		function formatCount(value) {
			if (!Number.isFinite(value)) return "";
			if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
			if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
			return String(Math.round(value));
		}

		function useSnapshot(store) {
			const usable = store !== null && store !== undefined && typeof store.getSnapshot === "function";
			const read = React.useCallback(() => (usable ? store.getSnapshot() : null), [usable, store]);
			const subscribe = React.useCallback((listener) => (usable && typeof store.subscribe === "function"
				? store.subscribe(listener)
				: () => {}), [usable, store]);
			return React.useSyncExternalStore(subscribe, read, read);
		}

		const STYLE_ID = "dsh-plugin-thinking-level/style";
		const CSS = `
.tl-wrap{box-sizing:border-box;width:100%;max-width:860px;margin:0 auto 8px;padding:0}
.tl-card{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) * 2 - var(--dsh-composer-dock-inset) * 4);max-width:calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) * 4);margin:0 auto;display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l1,#e5e5e5);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-specific-menu,#fff);backdrop-filter:var(--dsw-menu-backdrop-filter,none);box-shadow:var(--dsw-elevation-panel,0 4px 16px rgba(0,0,0,.08));color:var(--dsw-alias-label-primary,#111);font:inherit;font-size:13px;line-height:20px}
.tl-card[data-tone="lower"]{border-color:var(--dsw-alias-border-l1,#e5e5e5)}
.tl-icon{flex:none;display:grid;place-items:center;width:24px;height:24px;margin-top:1px;border-radius:50%;color:var(--dsw-alias-state-business-primary,#3b82f6);background:var(--dsw-alias-state-business-tertiary,rgba(59,130,246,.12))}
.tl-card[data-tone="raise"] .tl-icon{color:var(--dsw-alias-state-warning-primary,#b45309);background:var(--dsw-alias-state-warning-tertiary,rgba(245,158,11,.14))}
.tl-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.tl-title{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;color:var(--dsw-alias-label-primary,#111);font-weight:500}
.tl-badge{font-size:11px;font-weight:500;padding:1px 6px;border-radius:999px;color:var(--dsw-alias-label-secondary,#555);background:var(--dsw-alias-bg-module-platform,rgba(0,0,0,.05))}
.tl-reason{color:var(--dsw-alias-label-tertiary,#777);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.tl-error{color:var(--dsw-alias-state-error-primary,#dc2626);font-size:12px;line-height:18px}
.tl-actions{flex:none;display:flex;align-items:center;gap:4px;margin-left:2px}
.tl-button{font:inherit;font-size:12px;line-height:20px;padding:3px 10px;border-radius:var(--dsw-radius-md,8px);border:.5px solid transparent;cursor:pointer;white-space:nowrap}
.tl-button:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,#3b82f6);outline-offset:2px}
.tl-button[disabled]{cursor:default;opacity:.6}
.tl-apply{color:var(--dsw-static-neutral-00,#fff);background:var(--dsw-alias-state-business-primary,#2563eb)}
.tl-card[data-tone="raise"] .tl-apply{background:var(--dsw-alias-state-warning-primary,#b45309)}
.tl-dismiss{color:var(--dsw-alias-label-tertiary,#777);background:transparent;border-color:transparent;padding:3px 6px}
@media (hover:hover){.tl-apply:hover{filter:brightness(1.06)}.tl-dismiss:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}}
@media (max-width:720px){.tl-card{flex-wrap:wrap}.tl-actions{width:100%;justify-content:flex-end}}
@media (prefers-reduced-motion:reduce){.tl-card{transition:none}}
`;

		function ensureStyle() {
			if (typeof document === "undefined") return () => {};
			let tag = document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`);
			if (tag === null) {
				tag = document.createElement("style");
				tag.dataset.plugin = "dsh-plugin-thinking-level";
				tag.dataset.pluginCss = STYLE_ID;
				tag.textContent = CSS;
				document.head.appendChild(tag);
			}
			return () => {
				if (tag !== null && tag.parentNode !== null) tag.parentNode.removeChild(tag);
			};
		}

		const IconBulb = () => h("svg", { viewBox: "0 0 16 16", width: 15, height: 15, "aria-hidden": "true", fill: "none", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round", strokeLinejoin: "round" },
			h("path", { d: "M8 1.6a4.3 4.3 0 0 0-2.5 7.8c.45.33.7.82.76 1.34l.03.26h3.42l.03-.26c.06-.52.31-1.01.76-1.34A4.3 4.3 0 0 0 8 1.6Z" }),
			h("path", { d: "M6.4 12.8h3.2M7 14.2h2" })
		);

		const IconHistory = () => h("svg", { viewBox: "0 0 16 16", width: 15, height: 15, "aria-hidden": "true", fill: "none", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round", strokeLinejoin: "round" },
			h("path", { d: "M2.6 8a5.4 5.4 0 1 0 1.7-3.9" }),
			h("path", { d: "M2.2 2.6v3.2h3.2" }),
			h("path", { d: "M8 3.2v4.3l2.8 1.7" })
		);

		/** 同一档位被忽略后，要更极端的分数才再次提醒。 */
		function worthRepeating(suggestion) {
			if (suggestion.level === "high") return suggestion.score >= 8;
			if (suggestion.level === "medium") return suggestion.score >= 5;
			// 降档建议在同一会话里只提醒一次，忽略后不再啰嗦。
			return false;
		}

		function ThinkingDock(props) {
			const state = useSnapshot(props.inputState);
			const projected = useSnapshot(props.selectionStore);
			const session = useSnapshot(props.sessionStore);
			const outline = useSnapshot(props.outlineStore);
			const stats = useSnapshot(props.statsStore);
			const usage = useSnapshot(props.usageStore);
			const [catalog, setCatalog] = React.useState(props.catalog || null);
			const [dismissedFor, setDismissedFor] = React.useState("");
			const [applying, setApplying] = React.useState(false);
			const [applyError, setApplyError] = React.useState("");
			const [sessionDismissed, setSessionDismissed] = React.useState(false);
			const [sessionDismissedTurn, setSessionDismissedTurn] = React.useState(0);
			const [openingSession, setOpeningSession] = React.useState(false);
			const [openError, setOpenError] = React.useState("");
			const dismissedLevels = React.useRef([]);

			React.useEffect(() => {
				let cancelled = false;
				if (typeof props.loadCatalog !== "function") return () => {};
				props.loadCatalog().then((value) => {
					if (!cancelled) setCatalog(value || null);
				}).catch(() => {});
				return () => { cancelled = true; };
			}, [props.sessionId, projected]);

			const draft = state && typeof state.draft === "string" ? state.draft : "";
			const phase = state && typeof state.phase === "string" ? state.phase : "";
			const trimmed = draft.trim();
			// blank === false 说明会话已有历史轮次，这句是追问而不是新任务。
			const followUp = Boolean(session && session.blank === false);
			const history = React.useMemo(() => {
				const list = Array.isArray(outline) ? outline : (outline && Array.isArray(outline.turns) ? outline.turns : []);
				return list
					.slice(-6)
					.flatMap((turn) => [turn && turn.prompt, turn && turn.response])
					.filter((item) => typeof item === "string" && item.trim() !== "");
			}, [outline]);
			const project = typeof props.project === "string" ? props.project : null;
			const suggestion = React.useMemo(
				() => analyzeTask(draft, { followUp, history, project }),
				[draft, followUp, history, project]
			);
			const metrics = React.useMemo(() => sessionMetrics(stats, usage), [stats, usage]);
			const isSubagent = Boolean(session && session.subagent !== null && session.subagent !== undefined);
			const thresholdReached = (metrics.turns !== null && metrics.turns >= SESSION_TURN_LIMIT)
				|| metrics.effective >= SESSION_EFFECTIVE_TOKEN_LIMIT;
			const sessionDismissedNow = sessionDismissed
				&& (metrics.turns === null || metrics.turns < sessionDismissedTurn + 15);
			const showSessionCard = !isSubagent
				&& phase === "plain"
				&& trimmed === ""
				&& thresholdReached
				&& !sessionDismissedNow;

			function openNewSession() {
				if (openingSession || typeof props.createSession !== "function") return;
				setOpeningSession(true);
				setOpenError("");
				Promise.resolve(props.createSession()).catch((error) => {
					setOpenError(error instanceof Error ? error.message : String(error));
				}).finally(() => {
					setOpeningSession(false);
				});
			}

			if (showSessionCard) {
				const detail = [];
				if (metrics.totalTokens !== null) detail.push(`累计 ${formatCount(metrics.totalTokens)} tokens`);
				if (metrics.cacheHit !== null) detail.push(`缓存命中 ${Math.round(metrics.cacheHit * 100)}%`);
				if (metrics.effective > 0) detail.push(`估算计费约 ${formatCount(metrics.effective)}`);
				const title = metrics.turns !== null ? `这个会话已经 ${metrics.turns} 轮` : "这个会话已经很长";
				const line = detail.length > 0 ? `${detail.join(" · ")}。` : "";
				return h("div", { className: "tl-wrap", "data-session-notice": "1" },
					h("div", {
						className: "tl-card",
						"data-kind": "session",
						role: "status",
						"aria-live": "polite"
					},
						h("div", { className: "tl-icon" }, h(IconHistory)),
						h("div", { className: "tl-main" },
							h("div", { className: "tl-title" }, h("span", null, title)),
							h("div", { className: "tl-reason" }, `${line}继续下去每轮都会更慢、更贵，建议新开会话。`),
							openError === "" ? null : h("div", { className: "tl-error", role: "alert" }, `新建失败：${openError}`)
						),
						h("div", { className: "tl-actions" },
							typeof props.createSession === "function" ? h("button", {
								type: "button",
								className: "tl-button tl-apply",
								disabled: openingSession,
								onClick: openNewSession
							}, openingSession ? "新建中…" : "新建会话") : null,
							h("button", {
								type: "button",
								className: "tl-button tl-dismiss",
								onClick: () => {
									setSessionDismissed(true);
									setSessionDismissedTurn(metrics.turns === null ? 0 : metrics.turns);
								}
							}, "本会话不再提醒")
						)
					)
				);
			}

			const selection = currentSelectionOf(catalog, projected);
			const reasoning = selection === null ? null : reasoningFor(catalog, selection.provider, selection.model);
			const efforts = normalizeEfforts(reasoning);
			// 模型没有推理等级、或只有一个固定等级时，没有可切换的档位：完全不提醒。
			const hasAdjustableScale = efforts !== null && efforts.length > 1;

			const currentId = selection !== null && selection.reasoningEffort !== undefined
				? selection.reasoningEffort
				: reasoning && reasoning.defaultEffort !== undefined ? reasoning.defaultEffort : null;
			const currentIndex = hasAdjustableScale ? effortIndex(efforts, currentId) : null;
			const currentEffort = hasAdjustableScale && currentId !== null
				? efforts.find((item) => String(item.id).toLowerCase() === String(currentId).toLowerCase()) || null
				: null;
			const currentLabel = currentEffort !== null && currentEffort.name ? currentEffort.name : currentId === null ? "" : String(currentId);

			const suggestedEffort = hasAdjustableScale && suggestion !== null ? chooseEffort(efforts, suggestion.level) : null;
			const suggestedIndex = suggestedEffort === null ? null : effortIndex(efforts, suggestedEffort.id);
			const suggestedLabel = suggestedEffort !== null
				? (suggestedEffort.name || String(suggestedEffort.id))
				: "";

			const dismissed = dismissedFor !== "" && (
				trimmed === dismissedFor ||
				(trimmed.startsWith(dismissedFor) && trimmed.length - dismissedFor.length < 30) ||
				(dismissedFor.startsWith(trimmed) && dismissedFor.length - trimmed.length < 30)
			);

			if (isSubagent) return null;
			if (!hasAdjustableScale || selection === null || suggestedEffort === null || suggestedIndex === null) return null;
			if (suggestion === null || phase !== "plain" || dismissed) return null;
			if (dismissedLevels.current.includes(suggestion.level) && !worthRepeating(suggestion)) return null;
			if (applying === false && suggestedIndex !== null && currentIndex !== null && suggestedIndex === currentIndex) return null;
			const raising = currentIndex === null ? true : suggestedIndex > currentIndex;
			const tone = raising ? "raise" : "lower";
			const canApply = selection !== null && suggestedEffort !== null && typeof props.select === "function";
			const title = currentIndex === null
				? `建议用「${suggestedLabel}」推理等级`
				: raising
					? `建议把推理等级调到「${suggestedLabel}」`
					: `这个任务用「${suggestedLabel}」推理就够`;
			const reason = suggestion.reasons.join(" · ");

			const apply = () => {
				if (!canApply || applying) return;
				setApplying(true);
				setApplyError("");
				Promise.resolve(props.select({
					provider: selection.provider,
					model: selection.model,
					reasoningEffort: suggestedEffort.id
				})).then((result) => {
					if (result !== undefined && result !== null && result.ok === false) {
						throw new Error(result.error ? `${result.error.code}: ${result.error.message}` : "切换失败");
					}
				}).catch((error) => {
					setApplyError(error instanceof Error ? error.message : String(error));
				}).finally(() => {
					setApplying(false);
				});
			};

			return h("div", { className: "tl-wrap", "data-thinking-level": suggestion.level },
				h("div", {
					className: "tl-card",
					"data-tone": tone,
					role: "status",
					"aria-live": "polite"
				},
					h("div", { className: "tl-icon" }, h(IconBulb)),
					h("div", { className: "tl-main" },
						h("div", { className: "tl-title" },
							h("span", null, title),
							currentIndex === null ? null : h("span", { className: "tl-badge" }, `当前 ${currentLabel}`)
						),
						h("div", { className: "tl-reason" }, reason),
						applyError === "" ? null : h("div", { className: "tl-error", role: "alert" }, `切换失败：${applyError}`)
					),
					h("div", { className: "tl-actions" },
						canApply ? h("button", {
							type: "button",
							className: "tl-button tl-apply",
							disabled: applying,
							onClick: apply
						}, applying ? "切换中…" : `${raising ? "切到" : "降到"}${suggestedLabel}`) : null,
						h("button", {
							type: "button",
							className: "tl-button tl-dismiss",
							onClick: () => {
								if (!dismissedLevels.current.includes(suggestion.level)) dismissedLevels.current.push(suggestion.level);
								setDismissedFor(trimmed);
							}
						}, "忽略")
					)
				)
			);
		}
		function apply(ctx) {
			ctx.effect(() => ensureStyle(), "thinking-level: styles");

			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "thinking-level",
				order: 8,
				inject: (sessionId) => {
					let shell = null;
					try {
						const input = ctx.conversation && ctx.conversation.input;
						shell = input ? input.shell(sessionId) : null;
					} catch (_error) {}
					if (shell === null || shell === undefined) return {};

					let selectionStore = null;
					let sessionStore = null;
					let outlineStore = null;
					let statsStore = null;
					let usageStore = null;
					let cwd = null;
					try {
						const binding = ctx.sessions.binding(sessionId);
						sessionStore = binding && binding.session ? binding.session : null;
						const projections = binding && binding.session ? binding.session.projections : null;
						if (projections) {
							selectionStore = safeFace(projections, "modelSelection");
							outlineStore = safeFace(projections, "turnOutline");
							statsStore = safeFace(projections, "sessionStats");
							usageStore = safeFace(projections, "tokenUsage");
						}
						// 会话列表摘要里的 cwd 在空白会话就已存在；workingDirectory 投影
						// 有时要等第一个任务才填充，不能只依赖它。
						const listed = ctx.sessions.list && typeof ctx.sessions.list.getSnapshot === "function"
							? ctx.sessions.list.getSnapshot()
							: null;
						const summary = listed && listed.byId ? listed.byId[sessionId] : null;
						if (summary && typeof summary.cwd === "string" && summary.cwd !== "") cwd = summary.cwd;
						if (cwd === null && projections) {
							const cwdStore = safeFace(projections, "workingDirectory");
							const value = cwdStore && typeof cwdStore.getSnapshot === "function" ? cwdStore.getSnapshot() : null;
							if (typeof value === "string" && value !== "") cwd = value;
						}
					} catch (_error) {}

					let remoteSession;
					try {
						remoteSession = ctx.remote && ctx.remote.session;
					} catch (_error) {}

					let createSession;
					if (ctx.sessions && typeof ctx.sessions.create === "function") {
						createSession = () => {
							const uiWorkspace = typeof ctx.get === "function" ? ctx.get("uiWorkspace") : undefined;
							return createSessionIn(uiWorkspace, ctx.sessions, sessionId, cwd);
						};
					}

					return {
						sessionId,
						inputState: shell.state,
						selectionStore,
						sessionStore,
						outlineStore,
						statsStore,
						usageStore,
						project: cwd !== null && cwd.includes("baby_app") ? "baby_app" : null,
						loadCatalog: () => loadCatalog(ctx),
						createSession,
						select: remoteSession && typeof remoteSession.selectModel === "function"
							? (selection) => remoteSession.selectModel({ sessionId, ...selection })
							: undefined
					};
				}
			}, ThinkingDock));
		}

		exports.name = "thinking-level";
		exports.inject = ["slots", "sessions", "conversation", "remote", "remote.session"];
		exports.apply = apply;
		exports.analyzeTask = analyzeTask;
		exports.sessionMetrics = sessionMetrics;
		exports.workspaceForSession = workspaceForSession;
		exports.createSessionIn = createSessionIn;
		exports.formatCount = formatCount;
		exports.ThinkingDock = ThinkingDock;
		return module.exports;
	}
});
