#!/usr/bin/env bash
set -euo pipefail

# Create required EAS secrets for Supabase (project-scoped).
# Usage:
#   ./eas-build.sh
# Reads EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from the environment, or from .env if present.

if [[ -f .env ]]; then
	echo "Loading .env"
	set -a
	source ./.env
	set +a
fi

if [[ -z "${EXPO_PUBLIC_SUPABASE_URL:-}" || -z "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
	echo "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY (set in env or .env)" >&2
	exit 1
fi

echo "Creating EAS secrets for Supabase…"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "$EXPO_PUBLIC_SUPABASE_URL"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$EXPO_PUBLIC_SUPABASE_ANON_KEY"

echo "Done. You can now run internal builds, e.g.:"
echo "  eas build --platform ios --profile internal"
echo "  eas build --platform android --profile internal"
