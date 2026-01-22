function caesarShift(ch: string, shift: number): string {
  const code = ch.charCodeAt(0);
  const base = code >= 97 ? 97 : 65;
  const offset = (code - base + shift + 26) % 26;
  return String.fromCharCode(base + offset);
}

export const CODING_CONTRACT_ANSWERS_ENCRYPTION = {
  'Encryption I: Caesar Cipher': (data: [string, number]): string => {
    const [text, shift] = data;
    let out = '';
    for (const ch of text) {
      if (ch >= 'A' && ch <= 'Z') out += caesarShift(ch, -shift);
      else if (ch >= 'a' && ch <= 'z') out += caesarShift(ch, -shift);
      else out += ch;
    }
    return out;
  },
  'Encryption II: Vigenère Cipher': (data: [string, string]): string => {
    const [text, key] = data;
    let out = '';
    let ki = 0;
    for (const ch of text) {
      if (ch >= 'A' && ch <= 'Z') {
        const shift = key[ki % key.length].toUpperCase().charCodeAt(0) - 65;
        out += caesarShift(ch, shift);
        ki++;
      } else if (ch >= 'a' && ch <= 'z') {
        const shift = key[ki % key.length].toUpperCase().charCodeAt(0) - 65;
        out += caesarShift(ch, shift);
        ki++;
      } else {
        out += ch;
      }
    }
    return out;
  },
} as Record<string, (data: unknown) => unknown>;
