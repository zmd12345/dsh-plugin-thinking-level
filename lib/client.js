window.__ModuleLoader__.load({
	id: "dsh-plugin-thinking-level",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		const React = require("react");
		const h = React.createElement;

		/** 档位顺序；catalog 给出的自定义 id 会按实际顺序兜底。 */
		const LEVEL_ORDER = ["low", "medium", "high", "max"];
		const LEVEL_LABEL = { low: "低", medium: "中", high: "高", max: "最高" };
		const FALLBACK_EFFORTS = Object.freeze([
			{ id: "low", name: "低" },
			{ id: "medium", name: "中" },
			{ id: "high", name: "高" }
		]);

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
			"示例", "总结", "评估", "校准", "验证"
		];
		const SIMPLE_WORDS = [
			"翻译", "格式化", "改名", "文案", "列出", "是什么", "确认", "删除",
			"打开", "复制", "粘贴", "截图", "颜色", "字体", "拼写", "错别字", "一句话",
			"简单", "快速", "只需要", "只需", "不用改"
		];
		const STEP_WORDS = ["然后", "接着", "最后", "首先", "其次", "并且", "同时", "分别", "再"];
		const CONSTRAINT_WORDS = ["必须", "不要", "禁止", "务必", "不能", "需要保证", "不能破坏"];

		/**
		 * 本地启发式评估：零网络、零延迟，只根据输入文本给出建议档位。
		 * 规则刻意保守——宁可少提醒，也不要在简单任务上反复打扰。
		 *
		 * @param {string} raw 输入框纯文本
		 * @returns {{level: 'low'|'medium'|'high', score: number, reasons: string[], hits: object}|null}
		 */
		function analyzeTask(raw) {
			const text = String(raw == null ? "" : raw).replace(/\r\n?/gu, "\n").trim();
			if (text === "" || text.startsWith("/")) return null;
			if (text.length < 6) return null;

			const lower = text.toLowerCase();
			const reasons = [];
			let score = 2;

			const hitsOf = (words) => {
				const found = [];
				for (const word of words) {
					const needle = word.toLowerCase();
					if (lower.includes(needle) && !found.includes(word)) found.push(word);
				}
				return found;
			};

			const highHits = hitsOf(HIGH_WORDS);
			const mediumHits = hitsOf(MEDIUM_WORDS);
			const simpleHits = hitsOf(SIMPLE_WORDS);
			const stepHits = hitsOf(STEP_WORDS);
			const constraintHits = hitsOf(CONSTRAINT_WORDS);

			if (highHits.length > 0) {
				score += highHits.length >= 2 ? 4 : 3;
				reasons.push(`涉及${highHits.slice(0, 3).join("、")}`);
			}
			if (mediumHits.length > 0) {
				score += Math.min(2, mediumHits.length);
				if (highHits.length === 0) reasons.push(`需要${mediumHits.slice(0, 2).join("、")}`);
			}
			if (simpleHits.length > 0) {
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
			const level = score >= 6 ? "high" : score >= 3 ? "medium" : "low";

			if (reasons.length === 0) reasons.push(level === "low" ? "任务比较直接" : "任务信息量一般");

			return {
				level,
				score,
				reasons: Array.from(new Set(reasons)).slice(0, 3),
				hits: { high: highHits, medium: mediumHits, simple: simpleHits }
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

		function levelLabel(id) {
			return LEVEL_LABEL[String(id || "").toLowerCase()] || String(id || "");
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

		function chooseEffort(efforts, level) {
			if (!Array.isArray(efforts) || efforts.length === 0) return null;
			const exact = efforts.find((item) => String(item.id).toLowerCase() === level);
			if (exact !== undefined) return exact;
			const byName = efforts.find((item) => String(item.name || "").includes(levelLabel(level)));
			if (byName !== undefined) return byName;
			if (level === "low") return efforts[0];
			if (level === "high") return efforts[efforts.length - 1];
			return efforts[Math.floor((efforts.length - 1) / 2)];
		}

		function currentSelectionOf(catalog, projected) {
			if (projected !== null && projected !== undefined) {
				const selected = projected.next || projected.lastUsed;
				if (selected !== null && selected !== undefined) return selected;
			}
			return catalog && catalog.default ? catalog.default : null;
		}

		function useSnapshot(store) {
			const safe = store || EMPTY_STORE;
			return React.useSyncExternalStore(
				React.useCallback((listener) => safe.subscribe(listener), [safe]),
				React.useCallback(() => safe.getSnapshot(), [safe]),
				React.useCallback(() => safe.getSnapshot(), [safe])
			);
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

		function ThinkingDock(props) {
			const state = useSnapshot(props.inputState);
			const projected = useSnapshot(props.selectionStore);
			const [catalog, setCatalog] = React.useState(props.catalog || null);
			const [dismissedFor, setDismissedFor] = React.useState("");
			const [applying, setApplying] = React.useState(false);
			const [applyError, setApplyError] = React.useState("");

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
			const suggestion = React.useMemo(() => analyzeTask(draft), [draft]);

			const selection = currentSelectionOf(catalog, projected);
			const reasoning = selection === null ? null : reasoningFor(catalog, selection.provider, selection.model);
			const efforts = normalizeEfforts(reasoning) || FALLBACK_EFFORTS;
			const hasCatalogEfforts = normalizeEfforts(reasoning) !== null;

			const currentId = selection !== null && selection.reasoningEffort !== undefined
				? selection.reasoningEffort
				: reasoning && reasoning.defaultEffort !== undefined ? reasoning.defaultEffort : null;
			const currentIndex = effortIndex(efforts, currentId);
			const currentEffort = currentId === null ? null : efforts.find((item) => String(item.id).toLowerCase() === String(currentId).toLowerCase()) || null;
			const currentLabel = currentEffort !== null && currentEffort.name ? currentEffort.name : currentId === null ? "未知" : levelLabel(currentId);

			const suggestedEffort = suggestion === null ? null : chooseEffort(efforts, suggestion.level);
			const suggestedIndex = suggestedEffort === null ? (suggestion === null ? null : LEVEL_ORDER.indexOf(suggestion.level)) : effortIndex(efforts, suggestedEffort.id);
			const suggestedLabel = suggestedEffort !== null && suggestedEffort.name ? suggestedEffort.name : suggestion === null ? "" : levelLabel(suggestion.level);

			const trimmed = draft.trim();
			const dismissed = dismissedFor !== "" && (
				trimmed === dismissedFor ||
				(trimmed.startsWith(dismissedFor) && trimmed.length - dismissedFor.length < 30) ||
				(dismissedFor.startsWith(trimmed) && dismissedFor.length - trimmed.length < 30)
			);

			if (suggestion === null || phase !== "plain" || dismissed || applying === false && suggestedIndex === currentIndex && currentIndex !== null) return null;
			if (suggestedIndex === null || currentIndex === null) {
				if (suggestion.level === "low") return null;
			}

			const raising = currentIndex === null ? true : suggestedIndex > currentIndex;
			const tone = raising ? "raise" : "lower";
			const standardScale = currentId !== null && ["low", "medium", "high"].includes(String(currentId).toLowerCase());
			const canApply = selection !== null && suggestedEffort !== null && typeof props.select === "function" && (hasCatalogEfforts || standardScale);
			const title = currentIndex === null
				? `建议用「${suggestedLabel}」档思考`
				: raising
					? `建议把思考档位调到「${suggestedLabel}」`
					: `这个任务用「${suggestedLabel}」档就够`;
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
							onClick: () => setDismissedFor(trimmed)
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
					try {
						const binding = ctx.sessions.binding(sessionId);
						selectionStore = binding && binding.session && binding.session.projections
							? binding.session.projections.faceOf("modelSelection")
							: null;
					} catch (_error) {}

					let remoteSession;
					try {
						remoteSession = ctx.remote && ctx.remote.session;
					} catch (_error) {}

					return {
						sessionId,
						inputState: shell.state,
						selectionStore,
						loadCatalog: () => loadCatalog(ctx),
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
		exports.ThinkingDock = ThinkingDock;
		return module.exports;
	}
});
