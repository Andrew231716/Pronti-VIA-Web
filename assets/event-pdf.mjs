import { getDocument, GlobalWorkerOptions } from "../vendor/pdfjs/pdf.min.mjs";

GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;

export async function readEventPdf(file) {
  const task = getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
  try {
    const doc = await task.promise;
    const lines = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const { items } = await page.getTextContent();
      let line = "";
      for (const item of items) {
        if (typeof item.str !== "string") continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        }
      }
      lines.push(line);
      page.cleanup();
    }
    const text = lines.join("\n").trim();
    if (!text) throw new Error("Il PDF non contiene testo selezionabile. Per una scansione, usa prima il riconoscimento del testo (OCR).");
    return text;
  } catch (error) {
    if (error.name === "PasswordException") throw new Error("Il PDF è protetto da password. Seleziona una copia sbloccata.");
    throw error;
  } finally {
    await task.destroy();
  }
}
