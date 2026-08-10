#!/usr/bin/env bash
# One command: set up Python, install PyTorch, train, print the score.
# Walk away. Come back to model/model.pt and model/report.json.
#
# Safe to re-run: the venv is reused, so a second run skips the download.
set -euo pipefail

cd "$(dirname "$0")"
VENV=".venv"
LOG="train.log"

echo "=============================================="
echo "  Cyrillic -> Mongol bichig : training run"
echo "=============================================="
echo

# --- 1. find a Python PyTorch actually has wheels for -------------------
# PyTorch lags new Python releases. 3.14 in particular may have no wheel yet,
# so prefer a known-good version and only fall back to whatever is on PATH.
PY=""
for cand in python3.12 python3.11 python3.13 python3.10 python3; do
  if command -v "$cand" >/dev/null 2>&1; then
    ver="$("$cand" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || echo "")"
    case "$ver" in
      3.10|3.11|3.12|3.13) PY="$cand"; break ;;
    esac
  fi
done

if [ -z "$PY" ]; then
  if command -v uv >/dev/null 2>&1; then
    echo "No suitable system Python. Using uv to fetch 3.12..."
    uv python install 3.12
    PY="$(uv python find 3.12)"
  else
    echo "ERROR: need Python 3.10-3.13 (PyTorch has no wheels for 3.14 yet)."
    echo
    echo "Fix with either:"
    echo "  brew install python@3.12"
    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh   # then re-run this script"
    exit 1
  fi
fi
echo "python      $PY ($("$PY" -c 'import sys; print(sys.version.split()[0])'))"

# --- 2. venv + deps ----------------------------------------------------
if [ ! -d "$VENV" ]; then
  echo "creating venv..."
  "$PY" -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"

if ! python -c "import torch" 2>/dev/null; then
  echo "installing PyTorch (~2 min, needs internet)..."
  pip install --quiet --upgrade pip
  # numpy is optional for torch but its absence prints a warning on every
  # import, which buries the training output.
  pip install --quiet torch numpy
fi
python -c "import torch; print('torch      ', torch.__version__)"
python -c "import torch; print('mps        ', torch.backends.mps.is_available())"
echo

# --- 3. train ----------------------------------------------------------
echo "training -- full log in $LOG"
echo "(safe to close the terminal only if you launched with nohup/tmux)"
echo
python train.py --data data --out model "$@" 2>&1 | tee "$LOG"

echo
echo "done. collect these two files:"
echo "  $(pwd)/model/model.pt"
echo "  $(pwd)/model/report.json"
