#!/usr/bin/env bash
# Optional: serve this static site on a Linux VM as a systemd service (for previews).
# Production is GitHub Pages. Safe to re-run: it updates the code and restarts.
#   sudo bash setup_service.sh [port]
#   journalctl -u abozar-site.service -f      # live logs
#   tail -f /var/log/abozar-site/site.log     # copyable log file (size limited)
set -euo pipefail

NAME=abozar-site
PORT="${1:-8090}"
DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_USER="${SUDO_USER:-$(whoami)}"
LOG_DIR=/var/log/$NAME

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash setup_service.sh"; exit 1; }

echo "1/4 packages"
command -v python3 >/dev/null || { apt-get update -y && apt-get install -y python3; }

echo "2/4 code"
if [ -d "$DIR/.git" ]; then sudo -u "$RUN_USER" git -C "$DIR" pull --ff-only || echo "git pull skipped"; fi

echo "3/4 logs (5 MB x 3 files, rotated daily)"
mkdir -p "$LOG_DIR" && chown "$RUN_USER" "$LOG_DIR"
cat > /etc/logrotate.d/$NAME <<ROT
$LOG_DIR/*.log {
  daily
  size 5M
  rotate 3
  compress
  missingok
  notifempty
  copytruncate
}
ROT

echo "4/4 service on port $PORT"
cat > /etc/systemd/system/$NAME.service <<UNIT
[Unit]
Description=abozaralizadeh.github.io static preview
After=network.target

[Service]
User=$RUN_USER
WorkingDirectory=$DIR
ExecStart=/usr/bin/python3 -m http.server $PORT --bind 0.0.0.0
Restart=always
StandardOutput=append:$LOG_DIR/site.log
StandardError=append:$LOG_DIR/site.log

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "$NAME" >/dev/null
systemctl restart "$NAME"
sleep 1
systemctl --no-pager --lines=3 status "$NAME" || true
echo "Done: http://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT  ·  logs: journalctl -u $NAME.service -f"
