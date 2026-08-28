import crypto from 'crypto';
import zlib from 'zlib';

export interface ExtractedPDFDocument {
  text: string;
  pageCount: number;
  pages: { pageNumber: number; text: string }[];
  tables: { pageNumber: number; headers: string[]; rows: string[][] }[];
  isScanned: boolean;
  checksum: string;
  fileSizeBytes: number;
}

/**
 * Calculates SHA-256 checksum of a buffer for immutable evidence tracking
 */
export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validates uploaded document for size, mime type, and security requirements
 */
export function validateUploadedDocument(
  file: Express.Multer.File | { originalname: string; size: number; mimetype: string; buffer: Buffer }
): { isValid: boolean; error?: string } {
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  const ALLOWED_MIMES = [
    'application/pdf',
    'text/plain',
    'application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (file.size > MAX_SIZE) {
    return { isValid: false, error: 'File size exceeds maximum allowable limit of 25MB.' };
  }

  const isPdfOrText =
    ALLOWED_MIMES.includes(file.mimetype) ||
    file.originalname.toLowerCase().endsWith('.pdf') ||
    file.originalname.toLowerCase().endsWith('.txt') ||
    file.originalname.toLowerCase().endsWith('.json');

  if (!isPdfOrText) {
    return { isValid: false, error: 'Invalid file format. Only PDF, TXT, and JSON documents are permitted.' };
  }

  // Basic security scanning
  const contentStr = file.buffer.toString('utf8', 0, Math.min(file.buffer.length, 4096));
  if (contentStr.includes('<script>') || contentStr.includes('javascript:')) {
    return { isValid: false, error: 'Malware/Script security violation detected in file header.' };
  }

  return { isValid: true };
}

/**
 * Extracts text and structured page boundaries from uploaded file buffer
 */
export async function parseDocumentContent(
  buffer: Buffer,
  filename: string
): Promise<ExtractedPDFDocument> {
  const checksum = calculateChecksum(buffer);
  const rawString = buffer.toString('utf8');

  // If file is JSON or plain text
  if (filename.toLowerCase().endsWith('.json')) {
    return {
      text: rawString,
      pageCount: 1,
      pages: [{ pageNumber: 1, text: rawString }],
      tables: [],
      isScanned: false,
      checksum,
      fileSizeBytes: buffer.length,
    };
  }

  // For PDF or text buffers, extract printable text and simulate/detect page boundaries
  let text = '';
  const pages: { pageNumber: number; text: string }[] = [];

  const isPdf = buffer.toString('ascii', 0, 5) === '%PDF-' || filename.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    let extractedPdfText = '';
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const uint8 = new Uint8Array(buffer);
      const loadingTask = pdfjsLib.getDocument({ data: uint8 });
      const pdfDoc = await loadingTask.promise;
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        pages.push({ pageNumber: i, text: pageText });
        extractedPdfText += pageText + '\n';
      }
    } catch (pdfJsErr) {
      console.warn('PDF.js text parsing error, attempting stream parser:', pdfJsErr);
    }

    if (extractedPdfText.trim().length > 30) {
      text = extractedPdfText.replace(/\s{2,}/g, ' ').trim();
    } else {
      try {
        const binaryStr = buffer.toString('binary');
        const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
        let match: RegExpExecArray | null;

        while ((match = streamRegex.exec(binaryStr)) !== null) {
          const streamBytes = Buffer.from(match[1], 'binary');
          let uncompressed: Buffer | null = null;
          try {
            uncompressed = zlib.inflateSync(streamBytes);
          } catch {
            try {
              uncompressed = zlib.inflateRawSync(streamBytes);
            } catch {
              uncompressed = null;
            }
          }

          const streamContent = uncompressed ? uncompressed.toString('utf8') : match[1];

          // Extract (text) Tj
          const tjMatches = streamContent.match(/\(([^()]+)\)\s*Tj/g);
          if (tjMatches) {
            for (const m of tjMatches) {
              extractedPdfText += m.replace(/^\(/, '').replace(/\)\s*Tj$/, '') + ' ';
            }
          }

          // Extract [(array)] TJ
          const arrayTjMatches = streamContent.match(/\[(.*?)\]\s*TJ/g);
          if (arrayTjMatches) {
            for (const arr of arrayTjMatches) {
              const inner = arr.match(/\(([^()]+)\)/g);
              if (inner) {
                for (const item of inner) {
                  extractedPdfText += item.slice(1, -1) + ' ';
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('PDF stream extraction notice:', e);
      }

      if (extractedPdfText.trim().length > 30) {
        text = extractedPdfText.replace(/\s{2,}/g, ' ').trim();
      } else {
        // Fallback clean ASCII/UTF-8 extraction
        const textMatches = rawString.match(/\(([^()]+)\)Tj/g) || [];
        if (textMatches.length > 0) {
          text = textMatches
            .map((m) => m.replace(/^\(/, '').replace(/\)Tj$/, ''))
            .join(' ');
        } else {
          text = rawString.replace(/[^\x20-\x7E\n\r\t°]/g, ' ').replace(/\s{2,}/g, ' ');
        }
      }
    }
  } else {
    // Non-PDF text buffer
    text = rawString;
  }

  // Retain pure extracted document text without polluting content stream with filenames
  const fullDocumentText = text.trim();

  // Divide into realistic pages
  const pageChunks = fullDocumentText.match(/[\s\S]{1,1800}/g) || [fullDocumentText];
  pageChunks.forEach((chunk, idx) => {
    pages.push({
      pageNumber: idx + 1,
      text: chunk,
    });
  });

  return {
    text: fullDocumentText,
    pageCount: pages.length,
    pages,
    tables: [],
    isScanned: false,
    checksum,
    fileSizeBytes: buffer.length,
  };
}
