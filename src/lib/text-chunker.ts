export function chunkText(
  text: string,
  chunkSize: number = 500,
  overlap: number = 100
): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  const maxChunks = 2000; // Safety cap to prevent runaway loops

  while (start < cleaned.length && chunks.length < maxChunks) {
    let end = Math.min(start + chunkSize, cleaned.length);

    if (end < cleaned.length) {
      // Try to break at sentence boundaries
      const searchEnd = cleaned.substring(start, end);
      const lastPeriod = Math.max(
        searchEnd.lastIndexOf(". "),
        searchEnd.lastIndexOf(".\n"),
        searchEnd.lastIndexOf("! "),
        searchEnd.lastIndexOf("? ")
      );

      // Only use sentence boundary if it's far enough into the chunk
      // to ensure we make meaningful forward progress
      if (lastPeriod > Math.max(chunkSize * 0.3, overlap + 1)) {
        end = start + lastPeriod + 1;
      }
    }

    const chunk = cleaned.substring(start, end).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    // CRITICAL: ensure start always moves forward by at least (end - overlap) or 1
    const nextStart = end - overlap;
    start = Math.max(nextStart, start + 1);
  }

  if (chunks.length >= maxChunks) {
    console.warn(`[Chunker] Hit max chunk limit (${maxChunks}), text may be truncated`);
  }

  return chunks;
}

export async function parseFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/csv"
  ) {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfModule = await import("pdf-parse") as any;
    const pdfParse = pdfModule.default || pdfModule;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
