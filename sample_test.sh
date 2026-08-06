#!/usr/bin/env bash
# Sample API calls using a durable AI Hay key (or AIHAY_DEV_KEY).
# Usage:
#   export AIHAY_API_KEY='sk-aihay-...'
#   ./sample_test.sh
# Optional:
#   BASE_URL=http://localhost:3000 ./sample_test.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
AIHAY_API_KEY="${AIHAY_API_KEY:-${AIHAY_DEV_KEY:-sk-aihay-dev-local}}"

echo "== list models =="
curl -s "${BASE_URL}/v1/models" \
  -H "Authorization: Bearer ${AIHAY_API_KEY}"
echo
echo

echo "== chat (non-stream) =="
curl -s "${BASE_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${AIHAY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "hi"}],
    "stream": false
  }'
echo
echo

echo "== chat (stream) =="
curl -sN "${BASE_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${AIHAY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "xai/grok-4.5",
    "messages": [{"role": "user", "content": "hi"}],
    "stream": true
  }'
echo
