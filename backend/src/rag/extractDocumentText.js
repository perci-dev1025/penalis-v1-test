/**
 * Extract plain text from uploaded document (PDF or .txt) for Document Analysis mode.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const MAX_TEXT_LENGTH = 120000; // ~30k tokens; cap to avoid token limit

/**
 * @param {Buffer} buffer - File buffer
 * @param {string} [originalname] - Original filename (e.g. "sentencia.pdf")
 * @returns {Promise<string>} Extracted text
 */
export async function extractDocumentText(buffer, originalname = '') {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Document buffer is required');
  }
  const name = (originalname || '').toLowerCase();
  let text = '';
  if (name.endsWith('.txt')) {
    text = buffer.toString('utf-8');
  } else if (name.endsWith('.pdf') || (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46)) {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      text = (data && data.text) ? String(data.text) : '';
    } catch (err) {
      console.error('pdf-parse error:', err?.message);
      throw new Error('No se pudo extraer texto del PDF. Verifique que el archivo no esté dañado o protegido.');
    }
  } else {
    throw new Error('Formato no soportado. Use archivo PDF o TXT.');
  }
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (!trimmed) throw new Error('El documento no contiene texto extraíble.');
  return trimmed.length > MAX_TEXT_LENGTH ? trimmed.slice(0, MAX_TEXT_LENGTH) + '\n\n[Texto truncado por longitud.]' : trimmed;
}
