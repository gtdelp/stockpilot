#!/usr/bin/env bash
# =============================================================================
# Publica el historial Git Flow en GitHub con un Pull Request por rama.
#
#   1.ª fase:  bash scripts/publicar-git-flow.sh https://github.com/USUARIO/stockpilot.git
#              → sube main y develop, abre y fusiona un PR por cada rama hacia develop.
#   2.ª fase:  bash scripts/publicar-git-flow.sh --release
#              → PR release/1.0.0 → main (se fusiona cuando el CI pasa) y etiqueta v1.0.0.
#
# Requisitos: git y GitHub CLI (`gh auth login`). En Windows, ejecutar en Git Bash.
# =============================================================================
set -euo pipefail

# Ramas en orden de integración (cada una parte de la anterior)
BRANCHES=(
  "feature/project-setup|Estructura del proyecto, tooling y sistema de diseño"
  "feature/routing-auth|Enrutamiento, autenticación por roles y API REST"
  "feature/forms-validation|Formularios reactivos con validación asíncrona"
  "feature/shared-components|Componentes visuales reutilizables"
  "feature/exports|Exportación de informes en PDF y CSV"
  "feature/data-services|Vistas de gestión: productos, pedidos, usuarios y maestros"
  "feature/dashboard|Cuadro de mando con gráficos y tiempo real"
  "feature/responsive-a11y|Diseño adaptativo, accesibilidad y tests E2E"
  "feature/help-docs|Ayuda integrada, manual de usuario y documentación"
  "chore/ci-cd|Integración y despliegue continuos"
)
RELEASE_BRANCH="release/1.0.0"
TAG="v1.0.0"

die() { printf '\n❌ %s\n' "$1" >&2; exit 1; }
info() { printf '\n▶ %s\n' "$1"; }

command -v git >/dev/null || die "Git no está instalado."
command -v gh >/dev/null || die "GitHub CLI (gh) no está instalado: https://cli.github.com"
gh auth status >/dev/null 2>&1 || die "Inicia sesión en GitHub CLI con: gh auth login"
git diff --quiet && git diff --cached --quiet || die "Hay cambios sin confirmar. Haz commit o descártalos antes de publicar."

pr_body() {
  printf '## Qué cambia\n\n%s\n\n## Cómo probarlo\n\n- `npm ci && npm start` (modo demostración)\n- `npm test`, `npm run test:api` y `npm run test:e2e`\n\n## Checklist\n\n- [x] Lint y formato sin errores\n- [x] Tests en verde\n- [x] Sin secretos ni datos personales reales\n' "$1"
}

merge_pr() {
  local head="$1" base="$2" title="$3"
  local number
  number=$(gh pr list --head "$head" --base "$base" --state all --json number --jq '.[0].number' 2>/dev/null || true)
  if [[ -z "$number" ]]; then
    gh pr create --head "$head" --base "$base" --title "$title" --body "$(pr_body "$title")" >/dev/null
    number=$(gh pr list --head "$head" --base "$base" --state open --json number --jq '.[0].number')
  fi
  local state
  state=$(gh pr view "$number" --json state --jq '.state')
  if [[ "$state" == "MERGED" ]]; then
    echo "   PR #$number ya fusionado."
    return
  fi
  gh pr merge "$number" --merge --subject "Merge pull request #$number: $title" >/dev/null
  echo "   PR #$number fusionado: $head → $base"
}

if [[ "${1:-}" == "--release" ]]; then
  info "Fase 2: release $RELEASE_BRANCH → main"
  git fetch origin --quiet
  git push --quiet -u origin "$RELEASE_BRANCH"
  number=$(gh pr list --head "$RELEASE_BRANCH" --base main --state all --json number --jq '.[0].number' 2>/dev/null || true)
  if [[ -z "$number" ]]; then
    gh pr create --head "$RELEASE_BRANCH" --base main --title "Release 1.0.0" --body "$(pr_body 'Primera versión estable de StockPilot. Ver CHANGELOG.md.')" >/dev/null
    number=$(gh pr list --head "$RELEASE_BRANCH" --base main --state open --json number --jq '.[0].number')
  fi
  info "Esperando a que el CI del PR #$number termine (puede tardar varios minutos)…"
  gh pr checks "$number" --watch --fail-fast || die "El CI ha fallado: revisa la pestaña Actions antes de continuar."
  gh pr merge "$number" --merge --subject "Merge pull request #$number: Release 1.0.0" >/dev/null
  git fetch origin --quiet
  git checkout --quiet main
  git reset --quiet --hard origin/main
  git tag -a "$TAG" -m "StockPilot 1.0.0" 2>/dev/null || true
  git push --quiet origin "$TAG"
  # Git Flow: la release también vuelve a develop
  git checkout --quiet develop
  git reset --quiet --hard origin/develop
  git merge --quiet --no-ff origin/main -m "chore: sincroniza develop con la release 1.0.0" || true
  git push --quiet origin develop
  info "✅ Release publicada y etiquetada ($TAG). El workflow «Deploy» desplegará en Vercel."
  exit 0
fi

REMOTE_URL="${1:-}"
[[ -n "$REMOTE_URL" ]] || die "Uso: bash scripts/publicar-git-flow.sh https://github.com/USUARIO/stockpilot.git"

info "Fase 1: publicando ramas y Pull Requests en $REMOTE_URL"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git push --quiet -u origin main
git push --quiet -u origin develop
gh repo set-default "$REMOTE_URL" >/dev/null 2>&1 || true

for entry in "${BRANCHES[@]}"; do
  branch="${entry%%|*}"
  title="${entry#*|}"
  info "$branch"
  git push --quiet -u origin "$branch"
  merge_pr "$branch" develop "$title"
done

git push --quiet -u origin "$RELEASE_BRANCH"
git fetch origin --quiet
info "✅ Fase 1 completada: ${#BRANCHES[@]} Pull Requests fusionados en develop."
echo "   Siguiente paso: configura Vercel y los secrets de GitHub (docs/PUESTA_EN_MARCHA.md, paso 5)"
echo "   y después ejecuta:  bash scripts/publicar-git-flow.sh --release"
