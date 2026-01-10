#!/usr/bin/env sh
# Wait for WinCC OA in container to be ready.
# Usage: wait-for-winccoa.sh <container-name> <max-retries>

container="$1"
max_retries="${2:-60}"
delay=2

if [ -z "$container" ]; then
  echo "Usage: $0 <container-name> [max-retries]"
  exit 2
fi

echo "Waiting for WinCC OA in container '$container' (max $max_retries attempts)..."
i=0
while [ $i -lt $max_retries ]; do
  i=$((i+1))
  docker exec "$container" sh -c "if [ -x /opt/WinCC_OA/bin/winccoa ]; then echo ready; exit 0; else exit 1; fi" >/dev/null 2>&1 && {
    echo "Ready after $i attempts"
    exit 0
  }
  sleep $delay
done

echo "Timed out waiting for WinCC OA in container '$container'"
exit 1
