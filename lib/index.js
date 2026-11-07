/**
 * Host half：纯 UI 插件。
 *
 * 浏览器端入口由 package.json 的 dsh.client 与 exports["./client"] 声明，
 * 这个空 apply 只用于让 Loader 在组合树里保留插件行。
 */
export const name = 'thinking-level'

export function apply() {}
