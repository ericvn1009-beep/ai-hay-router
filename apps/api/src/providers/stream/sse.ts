/**
 * Minimal SSE line parser for upstream event streams.
 */

export async function* readSseDataLines(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = indexOfEventBoundary(buffer)) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + (buffer[sep] === "\r" ? 4 : 2));
        const data = extractDataField(rawEvent);
        if (data !== null) {
          yield data;
        }
      }
    }

    if (buffer.trim()) {
      const data = extractDataField(buffer);
      if (data !== null) yield data;
    }
  } finally {
    reader.releaseLock();
  }
}

function indexOfEventBoundary(s: string): number {
  const n = s.indexOf("\n\n");
  const r = s.indexOf("\r\n\r\n");
  if (n === -1) return r;
  if (r === -1) return n;
  return Math.min(n, r);
}

function extractDataField(rawEvent: string): string | null {
  const lines = rawEvent.split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (dataLines.length === 0) return null;
  return dataLines.join("\n");
}
