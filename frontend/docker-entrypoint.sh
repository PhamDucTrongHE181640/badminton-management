#!/bin/sh
set -eu

PNPM_VERSION="${PNPM_VERSION:-11.2.2}"

export NODE_OPTIONS="${NODE_OPTIONS:---dns-result-order=ipv4first}"
export NPM_CONFIG_REGISTRY="${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org/}"

echo "Preparing pnpm ${PNPM_VERSION}..."
corepack enable || true
if ! corepack prepare "pnpm@${PNPM_VERSION}" --activate; then
  echo "Corepack could not download pnpm; falling back to npm global install..."
  npm install -g "pnpm@${PNPM_VERSION}" --registry="${NPM_CONFIG_REGISTRY}"
fi

echo "Using pnpm $(pnpm --version)"
pnpm install --frozen-lockfile
pnpm build

echo "Frontend static export is ready in /app/out"
exec tail -f /dev/null
