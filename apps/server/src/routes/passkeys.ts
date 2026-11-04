import type { Hono } from 'hono';
import type { CredentialsStore } from '../auth/credentials.js';

const MAX_DEVICE_NAME_LENGTH = 50;

export function mountPasskeyRoutes(
  api: Hono,
  credentials: CredentialsStore,
): void {
  api.get('/passkeys', async (c) => {
    const passkeys = (await credentials.list()).map((row) => ({
      id: row.id,
      deviceName: row.deviceName,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    }));
    return c.json(passkeys);
  });

  api.patch('/passkeys/:id', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400);
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      !('deviceName' in body) ||
      typeof (body as { deviceName: unknown }).deviceName !== 'string'
    ) {
      return c.json({ error: 'deviceName required' }, 400);
    }

    const deviceName = (body as { deviceName: string }).deviceName;
    if (deviceName.length === 0 || deviceName.length > MAX_DEVICE_NAME_LENGTH) {
      return c.json({ error: 'Invalid deviceName' }, 400);
    }

    const id = c.req.param('id');
    const updated = await credentials.updateDeviceName(id, deviceName);
    if (!updated) {
      return c.json({ error: 'Not Found' }, 404);
    }
    return c.body(null, 204);
  });

  api.delete('/passkeys/:id', async (c) => {
    const id = c.req.param('id');
    const existing = await credentials.getById(id);
    if (existing === undefined) {
      return c.json({ error: 'Not Found' }, 404);
    }
    if ((await credentials.count()) <= 1) {
      return c.json({ error: 'Cannot delete last passkey' }, 409);
    }
    await credentials.remove(id);
    return c.body(null, 204);
  });
}
