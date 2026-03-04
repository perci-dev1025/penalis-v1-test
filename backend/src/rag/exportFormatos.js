/**
 * Build .docx and PDF buffers from formatosDocument (six sections).
 * Used by POST /api/rag/export/formatos/docx and /pdf.
 */
import { Document, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';

const SECTION_LABELS = {
  heading: 'Encabezado',
  identification: 'Identificación',
  facts: 'Hechos',
  legalBasis: 'Fundamento jurídico',
  petition: 'Petitorio',
  dateSignature: 'Lugar y fecha / Firma',
};

function safeText(str) {
  return typeof str === 'string' && str.trim() ? str.trim() : '';
}

/**
 * @param {{ heading?: string; identification?: string; facts?: string; legalBasis?: string; petition?: string; dateSignature?: string }} doc
 * @returns {Promise<Buffer>}
 */
export async function buildDocxBuffer(doc) {
  const children = [];
  for (const [key, label] of Object.entries(SECTION_LABELS)) {
    const text = safeText(doc[key]);
    if (!text) continue;
    children.push(
      new Paragraph({
        children: [new TextRun({ text: label, bold: true })],
        spacing: { before: 200, after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text })],
        spacing: { after: 200 },
      }),
    );
  }
  const file = new Document({
    sections: [{ children }],
  });
  return Packer.toBuffer(file);
}

/**
 * @param {{ heading?: string; identification?: string; facts?: string; legalBasis?: string; petition?: string; dateSignature?: string }} doc
 * @returns {Promise<Buffer>}
 */
export function buildPdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const pdf = new PDFDocument({ margin: 50, size: 'A4' });
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const font = 'Helvetica';
    const fontSize = 11;
    const titleSize = 12;
    pdf.fontSize(fontSize).font(font);

    for (const [key, label] of Object.entries(SECTION_LABELS)) {
      const text = safeText(doc[key]);
      if (!text) continue;
      pdf.fontSize(titleSize).font(font).text(label, { continued: false });
      pdf.moveDown(0.3);
      pdf.fontSize(fontSize).text(text, { align: 'left', lineGap: 2 });
      pdf.moveDown(0.8);
    }

    pdf.end();
  });
}
