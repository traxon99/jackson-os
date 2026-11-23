import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { apiGet } from '../lib/api.js';
import { Tag, type Tone } from '../ui/primitives.js';
import { type PlayerState, useHlsPlayer } from './useHlsPlayer.js';

export type CameraStatus = 'live' | 'offline' | 'unknown';

export type Camera = {
  id: string;
  label: string;
  status: CameraStatus;
  tracks: string[];
  playlist: string;
};

export type CamerasResponse = { enabled: boolean; cameras: Camera[] };

export function useCameras() {
  return useQuery({
    queryKey: ['cameras'],
    queryFn: () => apiGet<CamerasResponse>('/api/cameras'),
    refetchInterval: 10_000,
  });
}

/** One word and one tone per state, so status never relies on color alone. */
export function cameraTag(
  status: CameraStatus,
  player: PlayerState,
): { tone: Tone; word: string } {
  if (status === 'offline') {
    return { tone: 'err', word: 'offline' };
  }
  if (player === 'playing') {
    return { tone: 'ok', word: 'live' };
  }
  if (player === 'error') {
    return { tone: 'err', word: 'err' };
  }
  if (status === 'unknown') {
    return { tone: 'warn', word: 'relay?' };
  }
  return { tone: 'warn', word: 'connecting' };
}

export function CamerasPage() {
  const cameras = useCameras();

  return (
    <section className="cameras" aria-label="Cameras">
      {cameras.isLoading ? <p className="t-mute">Loading cameras…</p> : null}
      {cameras.isError ? (
        <p className="t-err" role="alert">
          Couldn’t load cameras.
        </p>
      ) : null}
      {cameras.data !== undefined && !cameras.data.enabled ? (
        <div className="wf wf--disabled cameras__empty">
          <div className="wf__body">
            <p className="wf__disabled">No cameras configured</p>
            <p className="t-mute">
              Merge deploy/compose.cameras.yaml into the stack. See
              docs/CAMERAS.md.
            </p>
          </div>
        </div>
      ) : null}
      <div className="cameras__grid">
        {cameras.data?.cameras.map((camera) => (
          <CameraTile key={camera.id} camera={camera} />
        ))}
      </div>
    </section>
  );
}

function CameraTile({ camera }: { camera: Camera }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const active = camera.status !== 'offline' && !paused;
  const player = useHlsPlayer(videoRef, camera.playlist, active);
  const tag = cameraTag(camera.status, paused ? 'idle' : player.state);

  const onFullscreen = () => {
    const el = frameRef.current;
    if (el === null) {
      return;
    }
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen();
    } else if (el.requestFullscreen !== undefined) {
      void el.requestFullscreen();
    } else {
      // iOS Safari only lets the <video> itself go full screen.
      (
        videoRef.current as
          | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
          | null
      )?.webkitEnterFullscreen?.();
    }
  };

  return (
    <article
      ref={frameRef}
      className={`wf camera camera--${tag.tone}`}
      aria-label={camera.label}
    >
      <header className="wf__header">
        <h2 className="wf__title">{camera.label}</h2>
        <span className="wf__source">· {camera.id}</span>
        <span className="wf__spacer" />
        {camera.tracks.length > 0 ? (
          <span className="wf__age">{camera.tracks.join(' ')}</span>
        ) : null}
        <Tag tone={paused ? 'neutral' : tag.tone}>
          {paused ? 'paused' : tag.word}
        </Tag>
        {camera.status === 'offline' ? null : (
          <span className="wf__actions">
            <button type="button" onClick={() => setPaused((p) => !p)}>
              {paused ? 'play' : 'pause'}
            </button>
            <button type="button" onClick={onFullscreen}>
              full
            </button>
          </span>
        )}
      </header>
      <div className="camera__body">
        <video
          ref={videoRef}
          className="camera__video"
          muted
          playsInline
          autoPlay
          aria-label={`${camera.label} live view`}
        />
        {camera.status === 'offline' ? (
          <p className="camera__overlay">
            No signal from <b>{camera.id}</b>. Is the camera on?
          </p>
        ) : null}
        {camera.status !== 'offline' && player.state === 'error' ? (
          <p className="camera__overlay" role="alert">
            {player.error ?? 'Stream error'}. Retrying…
          </p>
        ) : null}
      </div>
    </article>
  );
}
