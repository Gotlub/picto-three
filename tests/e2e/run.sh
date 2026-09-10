#!/usr/bin/env bash
set -euo pipefail

root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
project="pictotree-e2e-$(date +%s)-$$"
artifacts="$root/tests/e2e/artifacts/$project"
mkdir -p "$artifacts"
export E2E_ARTIFACTS="$artifacts" E2E_UID="$(id -u)" E2E_GID="$(id -g)"

# Do not load .env or accept COMPOSE_FILE/PROJECT_NAME from the developer stack.
compose=(docker compose --env-file /dev/null --project-directory "$root"
  --project-name "$project" --file "$root/compose.e2e.yml")

cleanup() {
  status=$?
  trap - EXIT
  set +e
  "${compose[@]}" logs --no-color > "$artifacts/compose.log" 2>&1
  if ! "${compose[@]}" down --volumes --remove-orphans --rmi local; then
    printf '\nE2E cleanup failed for project %s; check Docker before retrying.\n' "$project" >&2
    if [ "$status" -eq 0 ]; then status=1; fi
  fi
  printf '\nE2E artifacts: %s\n' "$artifacts"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"${compose[@]}" build
"${compose[@]}" up --attach playwright --abort-on-container-exit --exit-code-from playwright
