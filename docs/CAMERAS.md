# Cameras

Jackson OS can show live video from cameras on the home network at **`/cameras`** (also in the side nav and ⌘K). Out of the box it expects two:

| id       | Camera                             | How it reaches the server                                                   |
| -------- | ---------------------------------- | --------------------------------------------------------------------------- |
| `pi`     | Raspberry Pi + Arducam             | The Pi runs MediaMTX (`deploy/pi/setup.sh`); the server pulls RTSP from it. |
| `webcam` | USB webcam plugged into the server | MediaMTX on the server reads `/dev/video0` with ffmpeg.                     |

## How it fits together

```
 Raspberry Pi                         Server (Docker Compose)                          Browser
┌───────────────────┐  RTSP/TCP  ┌──────────────────────────────┐  HTTP (private)  ┌─────┐  HTTPS + session
│ Arducam           │  password  │ mediamtx  (no host ports)    │ ───────────────▶ │ app │ ───────────────▶ /cameras
│ MediaMTX :8554    │ ◀───────── │  pi      ← pulls the Pi      │  :8888 HLS       │     │  /api/cameras/*
│ path "cam"        │   LAN only │  webcam  ← ffmpeg /dev/video0│  :9997 status    └─────┘
└───────────────────┘            └──────────────────────────────┘
```

- **MediaMTX** (pinned `bluenviron/mediamtx:1.21.4-ffmpeg`) is the relay. It turns both cameras into HLS. Config: [`deploy/cameras/mediamtx.yml`](../deploy/cameras/mediamtx.yml).
- **The relay has no host ports.** The only way to the video from outside the Compose network is through the app.
- **The app proxies HLS** at `GET /api/cameras/:id/hls/*`, behind the same session gate as every other `/api` route. Recovery-only sessions get 403, signed-out requests get 401, and nothing reaches the relay without a session. Only configured camera ids and plain HLS file names are forwarded. Responses are `Cache-Control: private, no-store`.
- **`GET /api/cameras`** lists the cameras with `live` / `offline` from the relay's control API.
- **The browser** plays the stream with [hls.js](https://github.com/video-dev/hls.js) (native HLS on iOS Safari). The CSP allows `media-src 'self' blob:` for this and nothing else new.
- Expect about **2–4 s latency** (fMP4 HLS, 1 s segments). That keeps it to roughly one playlist and one segment request per second per open camera, each of which does a session check.

## Setup (only Jackson can do these, on the hardware)

### 1. Raspberry Pi with the Arducam

Use Raspberry Pi OS **Bookworm** (64-bit preferred), on the same LAN as the server.

1. **Make the camera show up in libcamera.** Run `rpicam-hello --list-cameras`. If it lists your camera, skip ahead. If not, see [Pi camera not found](#pi-camera-not-found) below.
2. **Copy and run the setup script on the Pi.** Use the server's LAN IP for `SERVER_IP` so only the server can read the stream.

   ```bash
   scp deploy/pi/setup.sh pi@<pi-host>.local:~
   ssh pi@<pi-host>.local
   sudo SERVER_IP=<server LAN IP> ./setup.sh
   ```

   It installs MediaMTX v1.21.4 (checksum-verified), writes `/etc/mediamtx/mediamtx.yml` with path `cam` from the Arducam, creates a random password for user `jos`, and starts a `mediamtx` systemd service. Optional settings: `WIDTH`, `HEIGHT`, `FPS`, `BITRATE`, `HFLIP`, `VFLIP`, `TUNING_FILE`, `CAM_PASSWORD`.

3. **Copy the line it prints at the end.** It looks like this:

   ```
   PI_CAMERA_URL=rtsp://jos:<password>@<pi ip>:8554/cam
   ```

Give the Pi a fixed IP (a DHCP reservation in your router), or use `<pi-host>.local` in the URL if mDNS works from inside Docker on the server.

### 2. Webcam on the server

1. Plug it in and find its device: `v4l2-ctl --list-devices` (from `v4l-utils`). It is usually `/dev/video0`.
2. If it isn't `/dev/video0`, add `WEBCAM_DEVICE=/dev/videoN` to `deploy/.env`.

**Docker Desktop (Mac or Windows) can't pass a USB webcam into a container.** On a Linux server this just works. On a Mac or Windows server, run MediaMTX directly on the host for the webcam, the same way as the Pi, and point the relay at it with `MTX_PATHS_WEBCAM_SOURCE=rtsp://…@host.docker.internal:8554/cam`. You also need to remove the `devices:` lines from `compose.cameras.yaml` there.

### 3. Turn it on in the stack

1. Put the Pi line (and `WEBCAM_DEVICE` if needed) in **`deploy/.env`**. That file is gitignored. Compose reads it because it sits next to `compose.yaml`. Never commit it.

   ```bash
   # deploy/.env
   PI_CAMERA_URL=rtsp://jos:<password>@192.168.1.50:8554/cam
   # WEBCAM_DEVICE=/dev/video1
   # CAMERAS=pi=Pi cam,webcam=Desk webcam   # id=Label, ids match relay paths
   ```

2. Add the cameras file to the Compose command:

   ```bash
   docker compose -f deploy/compose.yaml -f deploy/compose.cameras.yaml up -d --build
   ```

3. For auto-deploy, list both override files in the systemd unit. Separate them with a space. Then run `sudo systemctl daemon-reload && sudo systemctl restart jackson-os-autodeploy`.

   ```ini
   Environment=COMPOSE_OVERRIDE=deploy/compose.tunnel.yaml deploy/compose.cameras.yaml
   ```

4. Open **`/cameras`**. Each tile shows `LIVE`, `CONNECTING`, `OFFLINE` or `ERR`.

## Adding another camera

1. Add a path to `deploy/cameras/mediamtx.yml` (for another Pi: `source: publisher`, then set `MTX_PATHS_<NAME>_SOURCE` in `compose.cameras.yaml` from a `deploy/.env` variable).
2. Add `id=Label` to `CAMERAS`. The id must be the path name (`a-z`, `0-9`, `-`, `_`).

## Troubleshooting

**Check the relay first:** run `docker compose -f deploy/compose.yaml -f deploy/compose.cameras.yaml logs -f mediamtx`.

### Pi camera not found

`rpicam-hello --list-cameras` must list the camera before MediaMTX can use it.

- **Official-compatible Arducam modules** (IMX219, IMX477, IMX708, IMX519, 64MP OV64A40/Hawkeye): in `/boot/firmware/config.txt`, set `camera_auto_detect=0` and add the overlay Arducam's docs give for your sensor, for example `dtoverlay=imx519`. Then reboot.
- **Modules that need Arducam's own libcamera build or tuning file:** install them as Arducam documents. Then re-run `setup.sh` with `TUNING_FILE=/path/to/tuning.json`.
- Reseat the ribbon cable with the Pi powered off. A Pi 5 needs the narrower 22-pin cable.
- On the Pi, run `journalctl -u mediamtx -f` to see MediaMTX's camera errors.

### Pi shows OFFLINE but the Pi service is running

- From the server, run `ffprobe "rtsp://jos:<password>@<pi ip>:8554/cam"`. A `401` means the password in `deploy/.env` is wrong. A timeout means the network is blocking it, the IP is wrong, or `SERVER_IP` doesn't match the server's address as the Pi sees it.
- After editing `deploy/.env`, run `up -d` again. A restart alone won't pick up a changed env var.

### Webcam troubleshooting

- Run `docker compose … exec mediamtx ffmpeg -f v4l2 -list_formats all -i /dev/video0` to see what the camera supports.
- If it has no `mjpeg` at 1280x720, override the command in `compose.cameras.yaml` under `mediamtx.environment`. For example, drop `-input_format mjpeg` or use `-video_size 640x480`:

  ```yaml
  MTX_PATHS_WEBCAM_RUNONINIT: >-
    ffmpeg -hide_banner -loglevel warning -f v4l2 -video_size 640x480 -framerate 30 -i /dev/video0
    -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 30 -b:v 1500k
    -an -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:$$RTSP_PORT/$$MTX_PATH
  ```

  (In Compose files, write `$` as `$$`.)

- **No webcam at all?** The `devices:` line stops the relay from starting if the device is missing. Remove it, and remove `webcam` from `CAMERAS`.

## Security notes

- Video only leaves the server through `/api/cameras/*`, which requires a full session. There is no public stream URL, and no token sits in a URL.
- The Pi's RTSP is LAN-only and password-protected, and it is limited to `SERVER_IP` when that is set. RTSP Basic auth is plaintext on the LAN. That's acceptable on a home network, but don't port-forward 8554.
- Only processes inside the relay container can publish. Nothing else can inject a stream.
- `deploy/compose.cameras.yaml` is covered by a test (`apps/server/src/deploy-compose.test.ts`) that fails if someone adds `ports:` or host networking to the relay.
