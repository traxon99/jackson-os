import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const deployDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../deploy',
);

describe('deploy/compose.tunnel.yaml', () => {
  it('sets TRUST_CLOUDFLARE on the app service for tunnel deployments', () => {
    const content = readFileSync(
      join(deployDir, 'compose.tunnel.yaml'),
      'utf8',
    );
    expect(content).toMatch(/TRUST_CLOUDFLARE:\s*["']?true["']?/);
    expect(content).toMatch(/^\s*app:\s*$/m);
  });
});

describe('deploy/compose.cameras.yaml', () => {
  const compose = () =>
    readFileSync(join(deployDir, 'compose.cameras.yaml'), 'utf8');
  const relay = () =>
    readFileSync(join(deployDir, 'cameras/mediamtx.yml'), 'utf8');

  it('never publishes relay ports to the host', () => {
    // Streams must only reach browsers through the authenticated app proxy.
    expect(compose()).not.toMatch(/^\s*ports:/m);
    expect(compose()).not.toMatch(/network_mode:\s*host/);
  });

  it('points the app at the relay on the private network', () => {
    expect(compose()).toMatch(/MEDIAMTX_HLS_URL:\s*http:\/\/mediamtx:8888/);
    expect(compose()).toMatch(/image:\s*bluenviron\/mediamtx:\d+\.\d+\.\d+/);
  });

  it('only lets localhost publish and keeps RTSP on localhost', () => {
    const config = relay();
    expect(config).toMatch(/rtspAddress:\s*127\.0\.0\.1:8554/);
    const publishBlock = config.match(
      /- user: any\s+pass:\s+ips: \[([^\]]*)\]\s+permissions:\s+- action: publish/,
    );
    expect(publishBlock?.[1]).toBe('"127.0.0.1", "::1"');
    for (const off of ['rtmp', 'webrtc', 'srt', 'playback', 'metrics']) {
      expect(config).toMatch(new RegExp(`^${off}: false$`, 'm'));
    }
  });
});
