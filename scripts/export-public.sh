#!/usr/bin/env bash
# Crea una copia pulita del progetto per il repo pubblico "spindro" (storia nuova, un solo commit).
# Uso: scripts/export-public.sh <cartella-destinazione>
# Esclude: la vecchia chiave di firma, documenti interni, file generati.
set -euo pipefail
DEST="${1:?cartella di destinazione}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$DEST"
git -C "$SRC" ls-files -z | grep -zv -E '^(android/app/ridefreedom-debug\.keystore|docs/audit-segreti\.md|docs/DIREZIONE\.md|docs/PIANO-LANCIO\.md|docs/launch/|CNAME)' \
  | (cd "$SRC" && xargs -0 cp --parents -t "$DEST")
cd "$DEST"
# nessuna chiave o archivio di firma deve arrivare nel repo pubblico
if find . -name '*.keystore' -o -name '*.jks' -o -name '*.p12' | grep -q .; then echo "ERRORE: trovata una chiave di firma" >&2; exit 1; fi
if command -v gitleaks >/dev/null; then gitleaks detect --no-git --source . --redact; else echo "gitleaks non installato: controllo segreti saltato" >&2; fi
echo "Copia pulita pronta in $DEST"
