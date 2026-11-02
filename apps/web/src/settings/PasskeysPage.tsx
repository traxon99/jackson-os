import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api.js';
import { invalidateAuth } from '../auth/useAuth.js';
import { registerPasskey } from '../auth/webauthn.js';

type PasskeyRow = {
  id: string;
  deviceName: string | null;
  createdAt: number;
  lastUsedAt: number | null;
};

export function PasskeysPage() {
  const queryClient = useQueryClient();
  const passkeys = useQuery({
    queryKey: ['passkeys'],
    queryFn: () => apiGet<PasskeyRow[]>('/api/passkeys'),
  });

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = passkeys.data ?? [];
  const canRevoke = rows.length > 1;

  async function refreshPasskeys() {
    await queryClient.invalidateQueries({ queryKey: ['passkeys'] });
  }

  async function onAddPasskey() {
    setBusy(true);
    setError(null);
    try {
      await registerPasskey();
      await refreshPasskeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveRename(id: string) {
    const name = renameValue.trim();
    if (name.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/api/passkeys/${id}`, { deviceName: name });
      setRenameId(null);
      await refreshPasskeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/api/passkeys/${id}`);
      setConfirmRevokeId(null);
      await refreshPasskeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setBusy(false);
    }
  }

  const signOut = useMutation({
    mutationFn: () => apiPost('/api/auth/signout'),
    onSuccess: async () => {
      await invalidateAuth(queryClient);
      window.location.href = '/';
    },
  });

  const signOutAll = useMutation({
    mutationFn: () => apiPost('/api/auth/signout-all'),
    onSuccess: async () => {
      await invalidateAuth(queryClient);
      window.location.href = '/';
    },
  });

  if (passkeys.isLoading) {
    return <p className="settings-page">Loading passkeys…</p>;
  }

  return (
    <main className="settings-page">
      <h1>Passkeys</h1>
      <ul className="passkey-list">
        {rows.map((row) => (
          <li key={row.id}>
            {renameId === row.id ? (
              <>
                <input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  aria-label="Device name"
                />
                <button type="button" disabled={busy} onClick={() => onSaveRename(row.id)}>
                  Save
                </button>
                <button type="button" disabled={busy} onClick={() => setRenameId(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span>{row.deviceName ?? 'Unnamed device'}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRenameId(row.id);
                    setRenameValue(row.deviceName ?? '');
                  }}
                >
                  Rename
                </button>
                {confirmRevokeId === row.id ? (
                  <>
                    <span>Revoke this passkey?</span>
                    <button type="button" disabled={busy || !canRevoke} onClick={() => onRevoke(row.id)}>
                      Confirm revoke
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirmRevokeId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !canRevoke}
                    onClick={() => setConfirmRevokeId(row.id)}
                  >
                    Revoke
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      <button type="button" disabled={busy} onClick={onAddPasskey}>
        Add another passkey
      </button>

      <div className="recovery-actions">
        <button type="button" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
          Sign out
        </button>
        <button type="button" disabled={signOutAll.isPending} onClick={() => signOutAll.mutate()}>
          Sign out everywhere
        </button>
      </div>

      {error !== null ? <p className="error">{error}</p> : null}
    </main>
  );
}
