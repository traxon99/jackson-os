import { useState } from 'react';

type RecoveryCodesViewProps = {
  codes: string[];
  onConfirm: () => void;
};

export function RecoveryCodesView({
  codes,
  onConfirm,
}: RecoveryCodesViewProps) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  async function onCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  function onDownload() {
    const blob = new Blob([`${text}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'jackson-os-recovery-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="auth-page">
      <h1>Save your recovery codes</h1>
      <p>Store these somewhere safe. Each code works once.</p>
      <div className="recovery-codes" data-testid="recovery-codes">
        {codes.map((code) => (
          <div key={code}>{code}</div>
        ))}
      </div>
      <div className="recovery-actions">
        <button type="button" onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={onDownload}>
          Download .txt
        </button>
        <button type="button" onClick={onConfirm}>
          I saved these
        </button>
      </div>
    </main>
  );
}
