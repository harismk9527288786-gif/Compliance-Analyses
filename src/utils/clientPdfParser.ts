import * as pdfjsLib from 'pdfjs-dist';

// Set up worker for browser environment
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (e) {
    console.warn('Could not set workerSrc via import.meta.url:', e);
  }
}

export async function extractTextFromPdfClient(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    });
    const pdfDoc = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += pageText + '\n';
    }
    return fullText.replace(/\s{2,}/g, ' ').trim();
  } catch (err) {
    console.warn('Client-side PDF text extraction notice:', err);
    return '';
  }
}
