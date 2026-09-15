#!/usr/bin/env bash
set -euo pipefail

duration_seconds="${1:-900}"
interval_seconds="${2:-30}"
output_path="${3:-storage/load-tests/server-metrics.csv}"

mkdir -p "$(dirname "$output_path")"
printf 'timestamp,cpu_percent,mem_available_mb,swap_used_mb,disk_used_percent,service_active,recent_error_count\n' > "$output_path"

end_epoch=$(( $(date +%s) + duration_seconds ))
last_epoch=$(date +%s)

while (( $(date +%s) < end_epoch )); do
  read -r _ user nice system idle iowait irq softirq steal _ < /proc/stat
  first_idle=$((idle + iowait))
  first_total=$((user + nice + system + idle + iowait + irq + softirq + steal))
  sleep 1
  read -r _ user nice system idle iowait irq softirq steal _ < /proc/stat
  second_idle=$((idle + iowait))
  second_total=$((user + nice + system + idle + iowait + irq + softirq + steal))
  total_delta=$((second_total - first_total))
  idle_delta=$((second_idle - first_idle))
  cpu_percent=$(awk -v total="$total_delta" -v idle="$idle_delta" 'BEGIN { if (total <= 0) print "0.0"; else printf "%.1f", 100 * (total-idle) / total }')
  mem_available_mb=$(awk '/MemAvailable:/ {printf "%.1f", $2/1024}' /proc/meminfo)
  swap_used_mb=$(awk '/SwapTotal:/ {total=$2} /SwapFree:/ {free=$2} END {printf "%.1f", (total-free)/1024}' /proc/meminfo)
  disk_used_percent=$(df --output=pcent / | tail -n 1 | tr -dc '0-9')
  service_active=$(systemctl is-active utm-builder 2>/dev/null || true)
  now_epoch=$(date +%s)
  recent_error_count=$(journalctl -u utm-builder --since "@$last_epoch" --until "@$now_epoch" --no-pager 2>/dev/null | grep -Eic 'SQLITE_BUSY|database is locked|out of memory|ENOMEM|uncaught|fatal|error' || true)
  printf '%s,%s,%s,%s,%s,%s,%s\n' "$(date --iso-8601=seconds)" "$cpu_percent" "$mem_available_mb" "$swap_used_mb" "$disk_used_percent" "$service_active" "$recent_error_count" >> "$output_path"
  last_epoch="$now_epoch"
  sleep_for=$((interval_seconds - 1))
  (( sleep_for > 0 )) && sleep "$sleep_for"
done
