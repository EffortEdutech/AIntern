#!/usr/bin/env bash
# AIntern — cross-platform Graphify wrapper (POSIX counterpart to graphify.ps1)
# Used by Claude's Linux sandbox and any macOS/Linux environment.
# Installs the engine on demand (sandbox filesystems are ephemeral), then
# forwards all arguments, e.g.:  ./scripts/graphify.sh update .
set -euo pipefail

if ! command -v graphify >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/graphify" ]; then
  echo "Installing graphifyy from PyPI..."
  pip install graphifyy --break-system-packages --quiet
fi

export PATH="$HOME/.local/bin:$PATH"
exec graphify "$@"
