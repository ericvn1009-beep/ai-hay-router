#!/usr/bin/env bash
# Sample AI Hay Router API calls (v0.7.0+).
# Usage:
#   export AIHAY_API_KEY='sk-aihay-...'
#   ./sample_test.sh
# Optional:
#   BASE_URL=http://localhost:3000 ./sample_test.sh
#   MODEL=aihay/cheap ./sample_test.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
AIHAY_API_KEY="${AIHAY_API_KEY:-${AIHAY_DEV_KEY:-sk-aihay-dev-local}}"
MODEL="${MODEL:-openai/gpt-4o-mini}"

echo "== health =="
curl -s "${BASE_URL}/health"
echo
echo

echo "== list models =="
curl -s "${BASE_URL}/v1/models" \
  -H "Authorization: Bearer ${AIHAY_API_KEY}"
echo
echo

echo "== chat non-stream (${MODEL}) =="
curl -s "${BASE_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${AIHAY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"${MODEL}\",
    \"messages\": [{\"role\": \"user\", \"content\": \"hi\"}],
    \"stream\": false
  }"
echo
echo

echo "== chat stream (xai/grok-3-mini) =="
curl -sN "${BASE_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${AIHAY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "xai/grok-3-mini",
    "messages": [{"role": "user", "content": "hi"}],
    "stream": true
  }'
echo
