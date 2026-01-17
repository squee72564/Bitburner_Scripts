export function normalizeServer(input?: string): string {
  return input && input.trim() ? input.trim() : 'home';
}

export function assertFilename(filename: string): void {
  if (!filename || !filename.trim()) {
    throw new Error('filename must be a non-empty string');
  }
}

export function assertWriteSize(content: string, maxBytes: number): void {
  const size = Buffer.byteLength(content, 'utf8');
  if (size > maxBytes) {
    throw new Error(`content exceeds max size (${size} > ${maxBytes} bytes)`);
  }
}
