#!/bin/sh
# 把当前插件同步到 DSH 的运行时目录，并刷新 desktop profile。
# 运行时副本放在 ~/.dsh/plugins，外接盘未挂载时 DSH 仍能启动。
set -eu

name=$(node -p "require('./package.json').name")
dest="$HOME/.dsh/plugins/$name"
dsh_bin="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"

if [ ! -x "$dsh_bin" ]; then
  dsh_bin=$(command -v dsh || true)
fi
if [ -z "$dsh_bin" ] || [ ! -x "$dsh_bin" ]; then
  echo "找不到 dsh 命令；请把 DSH 的 cli/bin/dsh 加进 PATH" >&2
  exit 1
fi

mkdir -p "$dest"
rsync -a --delete --exclude .git --exclude dist ./ "$dest/"
"$dsh_bin" plugin --profile desktop add "$dest"
echo "installed: $name -> $dest"
