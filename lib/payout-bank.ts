import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type EncryptedValue = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function encryptionKey() {
  const encoded = process.env.BANK_DETAILS_ENCRYPTION_KEY;
  if (!encoded) throw new Error("BANK_DETAILS_ENCRYPTION_KEY manquante");

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("BANK_DETAILS_ENCRYPTION_KEY doit contenir 32 octets encodés en base64");
  }
  return key;
}

export function encryptBankValue(value: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptBankValue(value: EncryptedValue) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function normalizeIban(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function isValidIban(value: string) {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const numeric = /[A-Z]/.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character;
    for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function normalizeBic(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function isValidBic(value: string) {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalizeBic(value));
}

export function maskedIban(country: string, last4: string) {
  return `${country}•• •••• •••• •••• •••• ${last4}`;
}
