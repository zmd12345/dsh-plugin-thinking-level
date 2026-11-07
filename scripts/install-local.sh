#!/bin/sh
# 把当前插件目录直接挂进 desktop profile（link），改完刷新页面即可生效。
set -eu

dsh_bin="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
if [ ! -x "$dsh_bin" ]; then
  dsh_bin=$(command -v dsh || true)
fi
if [ -z "$dsh_bin" ] || [ ! -x "$dsh_bin" ]; then
  echo "找不到 dsh 命令；请把 DSH 的 cli/bin/dsh 加进 PATH" >&2
  exit 1
fi

"$dsh_bin" plugin --profile desktop add "$(pwd)"
echo "linked: $(pwd)"
