import { type RefObject, useEffect, useState } from 'react';

export type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

const RETRY_MS = 4_000;

type HlsModule = typeof import('hls.js');

let hlsModule: Promise<HlsModule> | null = null;

/** hls.js is ~400 kB, so it only loads once someone opens the cameras view. */
function loadHls(): Promise<HlsModule> {
  hlsModule ??= import('hls.js');
  return hlsModule;
}

/**
 * Plays an HLS playlist in `videoRef`. Uses hls.js where Media Source is
 * available, and the browser's native HLS (Safari, iOS) otherwise. Requests
 * are same-origin, so the session cookie rides along. Retries forever while
 * `enabled`, because cameras drop and come back.
 */
export function useHlsPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string,
  enabled: boolean,
): { state: PlayerState; error: string | null } {
  const [state, setState] = useState<PlayerState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || !enabled) {
      setState('idle');
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let destroyHls: (() => void) | undefined;

    const onPlaying = () => {
      if (!cancelled) {
        setState('playing');
        setError(null);
      }
    };
    const fail = (message: string) => {
      if (cancelled) {
        return;
      }
      setState('error');
      setError(message);
      destroyHls?.();
      destroyHls = undefined;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void start(), RETRY_MS);
    };
    const onVideoError = () => fail('Playback failed');

    video.addEventListener('playing', onPlaying);

    async function start() {
      if (cancelled || video === null) {
        return;
      }
      setState('loading');
      const { default: Hls } = await loadHls();
      if (cancelled) {
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          // The CSP has no worker-src blob:, so keep transmuxing on the main thread.
          enableWorker: false,
          lowLatencyMode: false,
          liveSyncDurationCount: 2,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 2,
          fragLoadingMaxRetry: 2,
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) {
            return;
          }
          const status = data.response?.code;
          if (status === 401) {
            window.dispatchEvent(new Event('jos:signed-out'));
          }
          fail(
            status === 404
              ? 'Stream not ready'
              : status === 502
                ? 'Relay unreachable'
                : 'Stream error',
          );
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        destroyHls = () => hls.destroy();
        void video.play().catch(() => {});
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl') !== '') {
        video.addEventListener('error', onVideoError, { once: true });
        video.src = src;
        destroyHls = () => {
          video.removeEventListener('error', onVideoError);
          video.removeAttribute('src');
          video.load();
        };
        void video.play().catch(() => {});
        return;
      }

      setState('error');
      setError('This browser can’t play HLS');
    }

    void start();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      video.removeEventListener('playing', onPlaying);
      destroyHls?.();
    };
  }, [videoRef, src, enabled]);

  return { state, error };
}
