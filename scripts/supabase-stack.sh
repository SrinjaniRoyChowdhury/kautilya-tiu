#!/bin/bash
set -euo pipefail

cleanup() {
  echo "Stopping Supabase stack (data volumes are kept)..."
  supabase stop 2>/dev/null || true
  exit 0
}

trap cleanup SIGTERM SIGINT

cd /workspace

if ! docker info >/dev/null 2>&1; then
  echo "Docker socket is not available. Mount /var/run/docker.sock into the supabase service." >&2
  exit 1
fi

# Supabase CLI health checks use 127.0.0.1, but containers publish ports on the host.
# Forward local ports to the host gateway so start/stop works from inside this container.
for port in 54320 54321 54322 54323 54324 54327; do
  socat "TCP-LISTEN:${port},fork,reuseaddr,bind=127.0.0.1" "TCP:host.docker.internal:${port}" &
done

if supabase status >/dev/null 2>&1; then
  echo "Supabase stack already running."
else
  echo "Starting Supabase stack..."
  supabase start --ignore-health-check
fi

echo "Supabase stack is up. Waiting for shutdown signal..."
while true; do
  sleep 30
done
