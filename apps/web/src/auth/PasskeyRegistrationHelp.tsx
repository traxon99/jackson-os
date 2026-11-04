/** Shown while hybrid (QR) passkey registration is in progress. */
export function PasskeyRegistrationHelp() {
  return (
    <p className="passkey-hybrid-hint">
      Scan the QR code in the browser prompt with your phone to create the
      passkey there.
    </p>
  );
}
