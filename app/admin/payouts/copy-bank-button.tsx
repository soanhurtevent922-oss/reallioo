"use client";

import { useState } from "react";

export default function CopyBankButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <button type="button" onClick={copy}>{copied ? "Copié ✓" : `Copier ${label}`}</button>;
}
