import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { apiPost } from '../lib/api.js';

type RegisterVerifyResponse = {
  ok: boolean;
  recoveryCodes?: string[];
};

export async function registerPasskey(setupToken?: string): Promise<string[]> {
  const options = await apiPost<PublicKeyCredentialCreationOptionsJSON>(
    '/api/auth/register/options',
    setupToken === undefined ? {} : { setupToken },
  );
  const attestation = await startRegistration({ optionsJSON: options });
  const result = await apiPost<RegisterVerifyResponse>(
    '/api/auth/register/verify',
    setupToken === undefined
      ? { response: attestation }
      : { setupToken, response: attestation },
  );
  return result.recoveryCodes ?? [];
}

export async function signInWithPasskey(): Promise<void> {
  const options = await apiPost<PublicKeyCredentialRequestOptionsJSON>(
    '/api/auth/login/options',
  );
  const assertion = await startAuthentication({ optionsJSON: options });
  await apiPost('/api/auth/login/verify', { response: assertion });
}
