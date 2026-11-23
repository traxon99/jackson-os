#!/usr/bin/env bash
# Run ON THE RASPBERRY PI to turn its Arducam into a password-protected RTSP
# stream that the Jackson OS relay pulls from. See docs/CAMERAS.md.
#
#   scp deploy/pi/setup.sh pi@jackson-pi.local:~
#   ssh pi@jackson-pi.local
#   sudo ./setup.sh                                 # defaults
#   sudo SERVER_IP=192.168.1.20 WIDTH=1920 HEIGHT=1080 ./setup.sh
#
# Env (all optional):
#   CAM_PASSWORD  read password for user "jos" (generated if unset; kept on re-run)
#   SERVER_IP     only this IP/CIDR may read the stream (recommended: the server's LAN IP)
#   WIDTH HEIGHT FPS BITRATE   capture settings (default 1280x720 @ 30, 2.5 Mbit/s)
#   HFLIP VFLIP   "true" to flip the image
#   TUNING_FILE   libcamera tuning file some Arducam modules need
#
# Re-running is safe: it rewrites the config and restarts the service.
set -euo pipefail

MTX_VERSION="v1.21.4"
declare -A MTX_SHA256=(
  [arm64]="47784081da54c0608ea4dc359f5cfb19880209434769c532b3ed3a67ea99c29d"
  [armv7]="48a067993e28e409478463dc71d2ee8a82511acebc4956f685ecfeda2b0bd9ae"
  [armv6]="c9fad01b59c31b434dcc25f8433624ffd09c369e2c2e0e43cb70423a546d1245"
)

WIDTH="${WIDTH:-1280}"
HEIGHT="${HEIGHT:-720}"
FPS="${FPS:-30}"
BITRATE="${BITRATE:-2500000}"
HFLIP="${HFLIP:-false}"
VFLIP="${VFLIP:-false}"
TUNING_FILE="${TUNING_FILE:-}"
SERVER_IP="${SERVER_IP:-}"

CONF_DIR=/etc/mediamtx
CONF="$CONF_DIR/mediamtx.yml"
PASS_FILE="$CONF_DIR/jos-password"
BIN=/usr/local/bin/mediamtx
UNIT=/etc/systemd/system/mediamtx.service

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi

case "$(uname -m)" in
  aarch64) arch=arm64 ;;
  armv7l) arch=armv7 ;;
  armv6l) arch=armv6 ;;
  *)
    echo "Unsupported CPU $(uname -m); this script is for a Raspberry Pi." >&2
    exit 1
    ;;
esac

echo "→ Checking the camera"
if command -v rpicam-hello >/dev/null 2>&1; then
  if ! rpicam-hello --list-cameras 2>&1 | grep -q '^[0-9] :'; then
    echo "No camera found by libcamera (rpicam-hello --list-cameras)." >&2
    echo "Fix the Arducam overlay first: see docs/CAMERAS.md, 'Pi camera not found'." >&2
    exit 1
  fi
else
  echo "  rpicam-hello not installed; skipping the check (sudo apt install rpicam-apps)."
fi

echo "→ Installing MediaMTX $MTX_VERSION ($arch)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
tarball="mediamtx_${MTX_VERSION}_linux_${arch}.tar.gz"
curl -fsSL -o "$tmp/$tarball" \
  "https://github.com/bluenviron/mediamtx/releases/download/${MTX_VERSION}/${tarball}"
echo "${MTX_SHA256[$arch]}  $tmp/$tarball" | sha256sum -c --quiet -
tar -xzf "$tmp/$tarball" -C "$tmp" mediamtx
install -m 0755 "$tmp/mediamtx" "$BIN"

id -u mediamtx >/dev/null 2>&1 ||
  useradd --system --no-create-home --shell /usr/sbin/nologin --groups video mediamtx
usermod -aG video mediamtx

install -d -m 0750 -o root -g mediamtx "$CONF_DIR"
if [[ -n "${CAM_PASSWORD:-}" ]]; then
  printf '%s' "$CAM_PASSWORD" >"$PASS_FILE"
elif [[ ! -s "$PASS_FILE" ]]; then
  # URL-safe so it can sit in rtsp://jos:<password>@host without escaping.
  tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32 >"$PASS_FILE"
fi
chmod 0600 "$PASS_FILE"
password="$(cat "$PASS_FILE")"
if [[ ! "$password" =~ ^[A-Za-z0-9._~-]+$ ]]; then
  echo "CAM_PASSWORD may only use A-Z a-z 0-9 . _ ~ - (it goes in a URL)." >&2
  exit 1
fi

if [[ -n "$SERVER_IP" ]]; then
  read_ips="[\"$SERVER_IP\"]"
else
  read_ips="[]"
fi

echo "→ Writing $CONF"
cat >"$CONF" <<YAML
# Written by jackson-os deploy/pi/setup.sh. Re-run the script to change it.
logLevel: info

authMethod: internal
authInternalUsers:
  # The Jackson OS relay reads with this user.
  - user: jos
    pass: "$password"
    ips: $read_ips
    permissions:
      - action: read
  # Local API/metrics only from the Pi itself.
  - user: any
    pass:
    ips: ["127.0.0.1", "::1"]
    permissions:
      - action: api

api: false
metrics: false
pprof: false
playback: false

rtsp: true
rtspTransports: [tcp]
rtspAddress: :8554

rtmp: false
hls: false
webrtc: false
srt: false

paths:
  cam:
    source: rpiCamera
    rpiCameraWidth: $WIDTH
    rpiCameraHeight: $HEIGHT
    rpiCameraFPS: $FPS
    rpiCameraBitrate: $BITRATE
    # One keyframe per second so the server's 1 s HLS segments line up.
    rpiCameraIDRPeriod: $FPS
    rpiCameraHFlip: $HFLIP
    rpiCameraVFlip: $VFLIP
    rpiCameraTuningFile: "$TUNING_FILE"
YAML
chown root:mediamtx "$CONF"
chmod 0640 "$CONF"

echo "→ Installing the systemd service"
cat >"$UNIT" <<UNIT
[Unit]
Description=MediaMTX camera stream for Jackson OS
After=network-online.target
Wants=network-online.target

[Service]
User=mediamtx
Group=mediamtx
SupplementaryGroups=video
ExecStart=$BIN $CONF
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable mediamtx >/dev/null
systemctl restart mediamtx
sleep 3
systemctl --no-pager --lines=5 status mediamtx || true

host="$(hostname).local"
ip="$(hostname -I | awk '{print $1}')"
cat <<DONE

Done. The Arducam is streaming on rtsp://$host:8554/cam (or $ip).

On the server, put this line in deploy/.env (it holds the password; never commit it):

  PI_CAMERA_URL=rtsp://jos:$password@$ip:8554/cam

Then restart the stack (docs/CAMERAS.md, step 3).
DONE
