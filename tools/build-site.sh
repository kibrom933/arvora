#!/usr/bin/env bash
# Samler alt, der skal på nettet, i tests/out/site-dist:
#   /            forsiden (site/index.html)
#   /demo/       prototypen med skrifter
#   /app/        den rigtige app (bygget med Vite; kræver npm ci i app/ først)
# Brug: tools/build-site.sh [BASE]   fx tools/build-site.sh /arvora/   (GitHub Pages) eller tools/build-site.sh /   (eget domæne)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="$ROOT/tests/out/site-dist"; BASE="${1:-/}"
rm -rf "$OUT"; mkdir -p "$OUT/demo/fonts"
cp "$ROOT/site/index.html" "$OUT/index.html"
cp "$ROOT/prototype/index.html" "$OUT/demo/index.html"
cp "$ROOT/prototype/fonts/"*.ttf "$OUT/demo/fonts/"
( cd "$ROOT/app" && VITE_BASE="${BASE%/}/app/" npx vite build --outDir "$OUT/app" --emptyOutDir >/dev/null )
cp "$OUT/app/index.html" "$OUT/404.html"   # GitHub Pages bruger kun 404.html i roden: ukendte stier (fx /app/bo/…) rammer appen, som selv finder vej
rm -f "$OUT/app/_redirects"
cat > "$OUT/_headers" <<'H'
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
H
printf '[build]\n  publish = "."\n' > "$OUT/netlify.toml"
touch "$OUT/.nojekyll"
echo "ok" > "$OUT/health.txt"
echo "built $OUT (base $BASE)"; find "$OUT" -type f | sed "s|$OUT||" | sort | head -30
