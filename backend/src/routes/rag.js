import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getEmbedding } from '../rag/embeddingProvider.js';
import { getMaestroResponse, getDebateMasterResponse, getConsultaResponse, getFormatosDocument, getAnalisisDocumentoResponse } from '../rag/llmProvider.js';
import { buildDocxBuffer, buildPdfBuffer } from '../rag/exportFormatos.js';
import { extractDocumentText } from '../rag/extractDocumentText.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ok = name.endsWith('.pdf') || name.endsWith('.txt') || file.mimetype === 'application/pdf' || file.mimetype === 'text/plain';
    if (ok) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF o TXT.'), false);
  },
});

const NORMATIVE_SOURCE_TYPES = new Set([
  'fundamental_norm',
  'special_penal_law',
  'treaty',
]);

/** Keywords that indicate a procedural (COPP) question rather than substantive penal. */
const PROCEDURAL_QUERY_KEYWORDS = [
  'medida cautelar',
  'cautelar sustitutiva',
  'presentacion periodica',
  'presentación periódica',
  'privacion de libertad',
  'privación de libertad',
  'audiencia',
  'sobreseimiento',
  'fase preparatoria',
  'acusacion',
  'acusación',
  'recurso',
  'apelacion',
  'apelación',
  'nulidad',
  'procesal',
  'copp',
  'codigo organico procesal',
  'código orgánico procesal',
  'medidas sustitutivas',
  'detencion preventiva',
  'detención preventiva',
  'control de la investigacion',
  'control de la investigación',
  'contestacion de acusacion',
  'contestación de acusación',
  'debate oral',
  'juicio oral',
  'sentencia',
  'recurso de apelacion',
  'recurso de apelación',
  'elementos de conviccion',
  'elementos de convicción',
  'abrir a juicio',
  'apertura a juicio',
  'fase intermedia',
  'ministerio publico',
  'ministerio público',
  'fiscal',
  'defensa',
];

function normalizeForMatch(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function isProceduralQuery(question) {
  const normalized = normalizeForMatch(question);
  return PROCEDURAL_QUERY_KEYWORDS.some((kw) =>
    normalized.includes(normalizeForMatch(kw)),
  );
}

function isProceduralDocument(path, name) {
  const combined = `${path || ''} ${name || ''}`.toLowerCase();
  return (
    /procesal|copp|organico-procesal|organico procesal|codigo-organico-procesal-penal|código orgánico procesal penal/i.test(
      combined,
    ) || /constitucion.*1999|constitution.*venezuela/i.test(combined)
  );
}

function isSubstantiveOnlyPenal(path, name) {
  const combined = `${path || ''} ${name || ''}`.toLowerCase();
  if (/procesal|copp|organico.*procesal/i.test(combined)) return false;
  return (
    /penal_code|code_penal|codigo penal|código penal|ve_penal/i.test(combined) &&
    !/procesal/i.test(combined)
  );
}

/** True when the question explicitly refers to COPP / Código Orgánico Procesal Penal. */
function queryExplicitlyMentionsCOPP(question) {
  const n = normalizeForMatch(question);
  return (
    n.includes('codigo organico procesal penal') ||
    n.includes('código orgánico procesal penal') ||
    /\bcopp\b/i.test(question) ||
    n.includes('codigo organico procesal')
  );
}

/** True when the document is specifically the COPP (path or name). */
function isCOPPDocument(path, name) {
  const combined = `${path || ''} ${name || ''}`.toLowerCase();
  return (
    /codigo-organico-procesal-penal|código orgánico procesal penal/i.test(combined) ||
    (/\bcopp\b/i.test(combined) && /procesal|penal/i.test(combined))
  );
}

/** True when the question asks for jurisprudence (TSJ, Sala de Casación, sentencia, etc.). */
function queryAsksForJurisprudence(question) {
  const n = normalizeForMatch(question);
  return (
    n.includes('jurisprudencia') ||
    n.includes('sala de casacion') ||
    n.includes('sala de casación') ||
    n.includes('tsj') ||
    n.includes('sentencia') ||
    n.includes('criterio del tribunal')
  );
}

/** True when the question is about proof at trial (incorporation, new proof, sobrevenida). */
function queryAboutProofAtTrial(question) {
  const n = normalizeForMatch(question);
  return (
    n.includes('incorporacion') ||
    n.includes('incorporación') ||
    n.includes('prueba nueva') ||
    n.includes('prueba sobrevenida') ||
    n.includes('sobrevenida') ||
    n.includes('prueba no promovida')
  );
}

/** Boost when chunk is highly relevant to proof-at-trial / incorporación excepcional (so BIV_02 and COPP Art. 339 rank higher). */
const PROOF_AT_TRIAL_CONTENT_BOOST = 0.25;

function chunkRelevantToProofAtTrial(chunkText, path, name) {
  const combined = `${(chunkText || '').toLowerCase()} ${(path || '').toLowerCase()} ${(name || '').toLowerCase()}`;
  return (
    /prueba\s+sobrevenida|incorporaci[oó]n\s+excepcional|incorporacion\s+excepcional/.test(combined) ||
    /art\.?\s*339|art[ií]culo\s+339/.test(combined) ||
    /art\.?\s*340|art[ií]culo\s+340/.test(combined) ||
    /art\.?\s*16\b|art[ií]culo\s+16\b/.test(combined) ||
    /art\.?\s*22\b|art[ií]culo\s+22\b/.test(combined) ||
    /conformidad\s+en\s+la\s+incorporaci[oó]n/.test(combined) ||
    /prueba_nueva_sobrevenida|biv_02|prueba nueva sobrevenida/i.test(combined) ||
    /audiencia\s+preliminar|promoci[oó]n\s+de\s+pruebas|libertad\s+probatoria|verdad\s+material/.test(combined)
  );
}

/** Number of top chunks sent to PROMPT MAESTRO and PROMPT MASTER SUPERIOR for stronger integrated legal basis. */
const MAESTRO_DEBATE_TOP_CHUNKS = Number(process.env.RAG_MAESTRO_TOP_CHUNKS) || 15;
/** Per-chunk character limit so doctrine/jurisprudence are less often cut off. */
const RAG_CHUNK_CHAR_LIMIT = Number(process.env.RAG_CHUNK_CHAR_LIMIT) || 1200;

const PROCEDURAL_BOOST = 0.15;
const SUBSTANTIVE_PENAL_PENALTY = 0.12;
/** Extra boost when the user explicitly asks about COPP so COPP ranks above Código Penal. */
const COPP_EXPLICIT_BOOST = 0.35;
/** Boost for COPP when in debate mode or procedural query (so COPP appears in top results). */
const COPP_PROCEDURAL_DEBATE_BOOST = 0.2;

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSimilarity(aTokens, bTokens) {
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const t of aSet) {
    if (bSet.has(t)) intersection += 1;
  }
  const unionSize = aSet.size + bSet.size - intersection;
  if (unionSize === 0) return 0;
  return intersection / unionSize;
}

function bufferToFloat32Array(buf) {
  return new Float32Array(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
}

function cosineSimilarity(a, b) {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getThresholdForMode(mode) {
  const defaultVal = 0.1;
  const base =
    Number.isFinite(parseFloat(process.env.RAG_SIMILARITY_THRESHOLD_DEFAULT))
      ? parseFloat(process.env.RAG_SIMILARITY_THRESHOLD_DEFAULT)
      : defaultVal;
  if (!mode) return base;
  const lower = String(mode).toLowerCase();
  if (lower === 'audiencia') {
    const v = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD_AUDIENCIA);
    return Number.isFinite(v) ? v : base;
  }
  if (lower === 'consulta') {
    const v = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD_CONSULTA);
    return Number.isFinite(v) ? v : base;
  }
  if (lower === 'debate') {
    const v = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD_DEBATE);
    return Number.isFinite(v) ? v : base;
  }
  if (lower === 'formatos') {
    const v = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD_FORMATOS);
    return Number.isFinite(v) ? v : base;
  }
  return base;
}

function hasMinimalFormatosStructuredData(question) {
  if (!question || typeof question !== 'string') return false;
  const q = question.toLowerCase();
  const requiredMarkers = [
    'rol procesal:',
    'tipo de escrito:',
    'etapa procesal:',
    'tribunal competente:',
    'hechos relevantes:',
    'finalidad del escrito:',
    'identificación de las partes:',
  ];
  return requiredMarkers.every((marker) => q.includes(marker));
}

/** Set RAG_DEBUG=1 or RAG_DEBUG=true to log retrieval context per request. Disable in production. */
const RAG_DEBUG = process.env.RAG_DEBUG === '1' || process.env.RAG_DEBUG === 'true';

function logRagContext(mode, topChunks, chunksContext, entries) {
  if (!RAG_DEBUG || !entries || !Array.isArray(entries)) return;
  const sourceTypes = entries.map((e) => e.chunk?.sourceType || e.chunk?.document?.sourceType).filter(Boolean);
  const docNames = entries.map((e) => e.chunk?.document?.name || e.chunk?.document?.path || '').filter(Boolean);
  console.log('[RAG]', {
    mode,
    numChunks: topChunks?.length ?? 0,
    chunksContextLength: chunksContext?.length ?? 0,
    sourceTypes: [...new Set(sourceTypes)],
    documentLabels: docNames.slice(0, 5),
  });
}

router.post('/query', requireAuth, async (req, res, next) => {
  try {
    const { question, mode, limit, role } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res
        .status(400)
        .json({ error: 'La pregunta (question) es requerida.' });
    }

    const modeLower = String(mode || '').toLowerCase();
    if (modeLower === 'audiencia') {
      const r = role != null ? String(role).toLowerCase() : '';
      if (r && r !== 'defensa' && r !== 'fiscal') {
        return res.status(400).json({
          error: 'En modo audiencia, el rol (role) debe ser "defensa" o "fiscal", o omitirse.',
        });
      }
    }
    if (modeLower === 'debate') {
      const r = role != null ? String(role).toLowerCase() : '';
      if (r && r !== 'defensa' && r !== 'fiscal') {
        return res.status(400).json({
          error: 'En modo debate, el rol (role) debe ser "defensa" o "fiscal", o omitirse.',
        });
      }
    }

    if (modeLower === 'formatos' && !hasMinimalFormatosStructuredData(question)) {
      const threshold = getThresholdForMode(mode);
      return res.status(200).json({
        id: null,
        abstained: true,
        threshold,
        message:
          'La información proporcionada es insuficiente o incompleta para generar un escrito técnicamente responsable. Complete al menos: rol procesal, tipo de escrito, etapa procesal, tribunal competente, hechos relevantes, finalidad del escrito e identificación de las partes.',
        results: [],
      });
    }

    const proceduralQuery = isProceduralQuery(question);
    const shouldFetchCOPP =
      queryExplicitlyMentionsCOPP(question) ||
      modeLower === 'debate' ||
      proceduralQuery;

    const maxResults = Number.isFinite(limit) ? Math.min(limit, 50) : 10;
    const threshold = getThresholdForMode(mode);

    let candidates = await prisma.legalChunk.findMany({
      take: 500,
      include: { document: true },
    });

    // When the user asks about COPP, is in debate mode, or asks a procedural question, ensure COPP chunks are in the pool.
    if (shouldFetchCOPP) {
      const candidateIds = new Set(candidates.map((c) => c.id));
      const coppChunks = await prisma.legalChunk.findMany({
        where: {
          document: {
            OR: [
              { path: { contains: 'codigo-organico-procesal-penal', mode: 'insensitive' } },
              { name: { contains: 'codigo-organico-procesal-penal', mode: 'insensitive' } },
            ],
          },
        },
        take: 300,
        include: { document: true },
      });
      for (const chunk of coppChunks) {
        if (!candidateIds.has(chunk.id)) {
          candidates.push(chunk);
          candidateIds.add(chunk.id);
        }
      }
    }

    // When the user asks for jurisprudence or about proof at trial, ensure jurisprudence and format chunks are in the pool (audiencia, debate, consulta).
    const shouldFetchJurisprudence =
      (modeLower === 'audiencia' || modeLower === 'debate' || modeLower === 'consulta') &&
      (queryAsksForJurisprudence(question) || queryAboutProofAtTrial(question));
    if (shouldFetchJurisprudence) {
      const candidateIds = new Set(candidates.map((c) => c.id));
      const jurisAndFormatChunks = await prisma.legalChunk.findMany({
        where: {
          sourceType: { in: ['jurisprudence', 'format'] },
        },
        take: 400,
        include: { document: true },
      });
      for (const chunk of jurisAndFormatChunks) {
        if (!candidateIds.has(chunk.id)) {
          candidates.push(chunk);
          candidateIds.add(chunk.id);
        }
      }
    }

    if (candidates.length === 0) {
      return res.status(200).json({
        id: null,
        abstained: true,
        threshold,
        results: [],
        message:
          'No hay fragmentos en el corpus. Ejecute "npm run rag:ingest" en el backend con la base de datos activa.',
      });
    }

    let scored;

    const queryEmbedding = await getEmbedding(question);
    const canUseEmbeddings =
      queryEmbedding &&
      candidates.some((c) => c.embedding && c.embedding.length > 0);

    if (canUseEmbeddings) {
      scored = candidates
        .filter((chunk) => chunk.embedding && chunk.embedding.length > 0)
        .map((chunk) => {
          const chunkVec = bufferToFloat32Array(chunk.embedding);
          const score = cosineSimilarity(queryEmbedding, chunkVec);
          return { chunk, score };
        })
        .filter((entry) => entry.score > 0);

      // When COPP should be included (explicit mention, debate mode, or procedural query), add COPP chunks that have no embedding.
      const shouldIncludeCOPPChunks = shouldFetchCOPP;
      if (shouldIncludeCOPPChunks) {
        const scoredChunkIds = new Set(scored.map((e) => e.chunk.id));
        const queryTokens = tokenize(question);
        for (const chunk of candidates) {
          if (scoredChunkIds.has(chunk.id)) continue;
          const doc = chunk.document;
          if (!doc || !isCOPPDocument(doc.path, doc.name)) continue;
          const score = jaccardSimilarity(queryTokens, tokenize(chunk.text));
          if (score <= 0) continue;
          scored.push({ chunk, score });
          scoredChunkIds.add(chunk.id);
        }
      }
      // When user asks for jurisprudence or proof at trial, add jurisprudence/format chunks that have no embedding (Jaccard).
      if (shouldFetchJurisprudence) {
        const scoredChunkIds = new Set(scored.map((e) => e.chunk.id));
        const queryTokens = tokenize(question);
        for (const chunk of candidates) {
          if (scoredChunkIds.has(chunk.id)) continue;
          if (chunk.sourceType !== 'jurisprudence' && chunk.sourceType !== 'format') continue;
          const score = jaccardSimilarity(queryTokens, tokenize(chunk.text));
          if (score <= 0) continue;
          scored.push({ chunk, score });
          scoredChunkIds.add(chunk.id);
        }
      }
    } else {
      const queryTokens = tokenize(question);
      scored = candidates
        .map((chunk) => {
          const score = jaccardSimilarity(queryTokens, tokenize(chunk.text));
          return { chunk, score };
        })
        .filter((entry) => entry.score > 0);
    }

    // Normative priority: sort normative sources first, then by score.
    scored.sort((a, b) => {
      const aNorm = NORMATIVE_SOURCE_TYPES.has(a.chunk.sourceType);
      const bNorm = NORMATIVE_SOURCE_TYPES.has(b.chunk.sourceType);
      if (aNorm !== bNorm) {
        return aNorm ? -1 : 1;
      }
      return b.score - a.score;
    });

    // Option C (Hybrid): for procedural queries, boost COPP/procedural docs and down-rank substantive-only Código Penal.
    const queryMentionsCOPP = queryExplicitlyMentionsCOPP(question);
    if (proceduralQuery || queryMentionsCOPP || modeLower === 'debate') {
      for (const entry of scored) {
        const doc = entry.chunk.document;
        const path = doc?.path ?? '';
        const name = doc?.name ?? '';
        if (proceduralQuery || modeLower === 'debate') {
          if (isProceduralDocument(path, name)) {
            entry.score += PROCEDURAL_BOOST;
          }
          if (isSubstantiveOnlyPenal(path, name)) {
            entry.score = Math.max(0, entry.score - SUBSTANTIVE_PENAL_PENALTY);
          }
        }
        if (queryMentionsCOPP && isCOPPDocument(path, name)) {
          entry.score += COPP_EXPLICIT_BOOST;
        } else if (
          (proceduralQuery || modeLower === 'debate') &&
          isCOPPDocument(path, name)
        ) {
          entry.score += COPP_PROCEDURAL_DEBATE_BOOST;
        }
        // When user asks for jurisprudence or about proof at trial, boost jurisprudence and format so they appear in top context.
        if (shouldFetchJurisprudence && (entry.chunk.sourceType === 'jurisprudence' || entry.chunk.sourceType === 'format')) {
          entry.score += PROCEDURAL_BOOST;
        }
      }
      scored.sort((a, b) => {
        const aNorm = NORMATIVE_SOURCE_TYPES.has(a.chunk.sourceType);
        const bNorm = NORMATIVE_SOURCE_TYPES.has(b.chunk.sourceType);
        if (aNorm !== bNorm) {
          return aNorm ? -1 : 1;
        }
        return b.score - a.score;
      });
    }

    // When question is about proof at trial, boost chunks with proof-at-trial content (BIV_02, Art. 339) even if procedural block did not run.
    if (queryAboutProofAtTrial(question)) {
      for (const entry of scored) {
        const doc = entry.chunk.document;
        if (chunkRelevantToProofAtTrial(entry.chunk.text, doc?.path, doc?.name)) {
          entry.score += PROOF_AT_TRIAL_CONTENT_BOOST;
        }
      }
      scored.sort((a, b) => {
        const aNorm = NORMATIVE_SOURCE_TYPES.has(a.chunk.sourceType);
        const bNorm = NORMATIVE_SOURCE_TYPES.has(b.chunk.sourceType);
        if (aNorm !== bNorm) return aNorm ? -1 : 1;
        return b.score - a.score;
      });
    }

    // In debate mode, ensure COPP is represented in the top results so the LLM and UI get procedural context.
    const minCOPPInTop = 3;
    const topN = Math.min(10, maxResults);
    if (modeLower === 'debate' && shouldFetchCOPP && scored.length > topN) {
      const coppEntries = scored.filter((e) => {
        const doc = e.chunk.document;
        return doc && isCOPPDocument(doc.path, doc.name);
      });
      const nonCOPP = scored.filter((e) => {
        const doc = e.chunk.document;
        return !doc || !isCOPPDocument(doc.path, doc.name);
      });
      if (coppEntries.length > 0 && coppEntries.length < scored.length) {
        const coppTop = coppEntries.slice(0, minCOPPInTop);
        const rest = scored.filter((e) => !coppTop.includes(e));
        const blended = [...coppTop, ...rest.slice(0, topN - coppTop.length)];
        blended.sort((a, b) => {
          const aNorm = NORMATIVE_SOURCE_TYPES.has(a.chunk.sourceType);
          const bNorm = NORMATIVE_SOURCE_TYPES.has(b.chunk.sourceType);
          if (aNorm !== bNorm) return aNorm ? -1 : 1;
          return b.score - a.score;
        });
        const blendedSet = new Set(blended);
        scored = [...blended, ...scored.filter((e) => !blendedSet.has(e))];
      }
    }

    // In audiencia or consulta mode when user asks for jurisprudence or about proof at trial, ensure jurisprudence/format appear in top context.
    const minJurisFormatInTop = 2;
    if (
      (modeLower === 'audiencia' || modeLower === 'consulta') &&
      shouldFetchJurisprudence &&
      scored.length > minJurisFormatInTop
    ) {
      const jurisFormatEntries = scored.filter(
        (e) => e.chunk.sourceType === 'jurisprudence' || e.chunk.sourceType === 'format',
      );
      const otherEntries = scored.filter(
        (e) => e.chunk.sourceType !== 'jurisprudence' && e.chunk.sourceType !== 'format',
      );
      if (
        jurisFormatEntries.length > 0 &&
        jurisFormatEntries.length < minJurisFormatInTop &&
        otherEntries.length > 0
      ) {
        const jurisTop = jurisFormatEntries.slice(0, minJurisFormatInTop);
        const takeCount = Math.max(maxResults, MAESTRO_DEBATE_TOP_CHUNKS);
        const rest = otherEntries.slice(0, takeCount - jurisTop.length);
        const blended = [...jurisTop, ...rest];
        blended.sort((a, b) => {
          const aNorm = NORMATIVE_SOURCE_TYPES.has(a.chunk.sourceType);
          const bNorm = NORMATIVE_SOURCE_TYPES.has(b.chunk.sourceType);
          if (aNorm !== bNorm) return aNorm ? -1 : 1;
          return b.score - a.score;
        });
        const blendedSet = new Set(blended);
        scored = [...blended, ...scored.filter((e) => !blendedSet.has(e))];
      }
    }

    const topK =
      modeLower === 'audiencia' || modeLower === 'debate' || modeLower === 'consulta'
        ? Math.max(maxResults, MAESTRO_DEBATE_TOP_CHUNKS)
        : maxResults;
    scored = scored.slice(0, topK);

    const passing = scored.filter((entry) => entry.score >= threshold);
    const normativePassing = passing.filter((entry) =>
      NORMATIVE_SOURCE_TYPES.has(entry.chunk.sourceType),
    );

    // Abstain when there is no normative source above threshold.
    const abstained = normativePassing.length === 0;

    const createPayload = {
      userId: req.user?.id ?? null,
      planId: req.user?.planId ?? null,
      mode: mode ?? null,
      question,
      similarityThreshold: threshold,
      abstained,
      sources: {
        create: scored.map((entry, index) => ({
          chunkId: entry.chunk.id,
          similarity: entry.score,
          rank: index + 1,
        })),
      },
    };

    const createdQuery = await prisma.query.create({
      data: createPayload,
      include: {
        sources: true,
      },
    });

    const passingIds = new Set(passing.map((p) => p.chunk.id));

    let brief = null;
    if (modeLower === 'audiencia' || modeLower === 'debate' || modeLower === 'formatos') {
      const topNormative =
        normativePassing[0] || passing[0] || scored[0];
      if (topNormative) {
        const doc = topNormative.chunk.document;
        const art = topNormative.chunk.article;
        const docLabel = doc.name || doc.path?.replace(/\.txt$/i, '') || 'norma';
        const articleLabel = art ? `Art. ${art} ${docLabel}` : docLabel;
        const phrase =
          topNormative.chunk.text?.trim().slice(0, 400) ||
          'Sin texto disponible.';
        brief = {
          action: `Fundamentar en ${docLabel}${art ? ` (Art. ${art})` : ''}.`,
          article: articleLabel,
          proceduralPhrase: phrase,
        };
      } else {
        brief = {
          action: 'No hay base normativa suficiente para sugerir una acción.',
          article: '—',
          proceduralPhrase: '—',
        };
      }
    }

    // PROMPT CONSULTA: run whenever there are scored chunks; prompt handles insufficient normative support (abstention paragraph).
    if (modeLower === 'consulta' && scored.length > 0) {
      const consultaEntries = scored.slice(0, MAESTRO_DEBATE_TOP_CHUNKS);
      const topChunks = consultaEntries.map((entry, i) => {
        const d = entry.chunk.document;
        const name = d?.name || d?.path || 'norma';
        const art = entry.chunk.article;
        const ref = art ? `Art. ${art} ${name}` : name;
        return `[${i + 1}] ${ref}\n${entry.chunk.text?.trim().slice(0, RAG_CHUNK_CHAR_LIMIT) ?? ''}`;
      });
      const chunksContext = topChunks.join('\n\n---\n\n');
      logRagContext('consulta', topChunks, chunksContext, consultaEntries);
      const consulta = await getConsultaResponse(question, chunksContext);
      if (consulta) {
        // Ensure brief exists so we can attach consulta analysis, even if action/article are not used in this mode.
        if (!brief) {
          brief = {
            action: '',
            article: '',
            proceduralPhrase: '',
          };
        }
        brief.consulta = consulta;
      }
    }

    // PROMPT MAESTRO: for audiencia mode with normative support, call LLM for 6-section tactical analysis.
    if (
      modeLower === 'audiencia' &&
      brief &&
      !abstained &&
      scored.length > 0
    ) {
      const audienciaEntries = scored.slice(0, MAESTRO_DEBATE_TOP_CHUNKS);
      const topChunks = audienciaEntries.map((entry, i) => {
        const d = entry.chunk.document;
        const name = d?.name || d?.path || 'norma';
        const art = entry.chunk.article;
        const ref = art ? `Art. ${art} ${name}` : name;
        return `[${i + 1}] ${ref}\n${entry.chunk.text?.trim().slice(0, RAG_CHUNK_CHAR_LIMIT) ?? ''}`;
      });
      const chunksContext = topChunks.join('\n\n---\n\n');
      logRagContext('audiencia', topChunks, chunksContext, audienciaEntries);
      const maestroRole =
        req.body?.role != null
          ? String(req.body.role).toLowerCase()
          : 'defensa';
      const maestro = await getMaestroResponse(maestroRole, question, chunksContext);
      if (maestro) {
        brief.maestro = maestro;
      }
    }

    // PROMPT MASTER SUPERIOR: for debate mode with normative support, call LLM for 9-section refutation analysis.
    if (
      modeLower === 'debate' &&
      brief &&
      !abstained &&
      scored.length > 0
    ) {
      const debateEntries = scored.slice(0, MAESTRO_DEBATE_TOP_CHUNKS);
      const topChunks = debateEntries.map((entry, i) => {
        const d = entry.chunk.document;
        const name = d?.name || d?.path || 'norma';
        const art = entry.chunk.article;
        const ref = art ? `Art. ${art} ${name}` : name;
        return `[${i + 1}] ${ref}\n${entry.chunk.text?.trim().slice(0, RAG_CHUNK_CHAR_LIMIT) ?? ''}`;
      });
      const chunksContext = topChunks.join('\n\n---\n\n');
      logRagContext('debate', topChunks, chunksContext, debateEntries);
      const debateRole =
        req.body?.role != null
          ? String(req.body.role).toLowerCase()
          : 'defensa';
      let debateMaster = await getDebateMasterResponse(debateRole, question, chunksContext);
      if (!debateMaster) {
        debateMaster = await getDebateMasterResponse(debateRole, question, chunksContext);
      }
      if (debateMaster) {
        brief.debateMaster = debateMaster;
      }
    }

    // PROMPT FORMATOS: for structured written mode, call LLM to generate full document (heading → date/signature).
    // Run even when abstained so the user still gets the full document and export; the prompt handles insufficient context.
    if (
      modeLower === 'formatos' &&
      brief &&
      scored.length > 0
    ) {
      const formatosEntries = scored.slice(0, MAESTRO_DEBATE_TOP_CHUNKS);
      const topChunks = formatosEntries.map((entry, i) => {
        const d = entry.chunk.document;
        const name = d?.name || d?.path || 'norma';
        const art = entry.chunk.article;
        const ref = art ? `Art. ${art} ${name}` : name;
        return `[${i + 1}] ${ref}\n${entry.chunk.text?.trim().slice(0, RAG_CHUNK_CHAR_LIMIT) ?? ''}`;
      });
      const chunksContext = topChunks.join('\n\n---\n\n');
      logRagContext('formatos', topChunks, chunksContext, formatosEntries);
      const formatosDoc = await getFormatosDocument(question, chunksContext);
      if (formatosDoc) {
        brief.formatosDocument = formatosDoc;
      }
    }

    return res.json({
      id: createdQuery.id,
      abstained,
      threshold,
      ...(abstained && {
        message:
          'No se encontró normativa suficiente por encima del umbral. Se sugiere ampliar la consulta o revisar el corpus.',
      }),
      ...(brief && { brief }),
      results: scored.map((entry, index) => ({
        id: entry.chunk.id,
        documentId: entry.chunk.documentId,
        article: entry.chunk.article,
        section: entry.chunk.section,
        text: entry.chunk.text,
        similarity: entry.score,
        rank: index + 1,
        sourceType: entry.chunk.sourceType,
        hierarchyRank: entry.chunk.hierarchyRank,
        passedThreshold: passingIds.has(entry.chunk.id),
        document: {
          id: entry.chunk.document.id,
          name: entry.chunk.document.name,
          path: entry.chunk.document.path,
          sourceType: entry.chunk.document.sourceType,
          hierarchyRank: entry.chunk.document.hierarchyRank,
          system: entry.chunk.document.system,
          organ: entry.chunk.document.organ,
        },
      })),
    });
  } catch (err) {
    console.error('RAG /query error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    next(err);
  }
});

/** POST /api/rag/analisis-documento — multipart: document (file PDF/TXT), question (optional). Analyzes document and returns legal/evidentiary/procedural weaknesses. */
router.post('/analisis-documento', requireAuth, upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Se requiere adjuntar un documento (PDF o TXT).' });
    }
    let documentText;
    try {
      documentText = await extractDocumentText(req.file.buffer, req.file.originalname);
    } catch (extractErr) {
      return res.status(400).json({ error: extractErr.message || 'Error al extraer texto del documento.' });
    }
    const question = (req.body && req.body.question) ? String(req.body.question).trim() : '';
    const ragQuery = question || 'Debilidades jurídicas, probatorias y procesales en documento penal. COPP y jurisprudencia.';

    let candidates = await prisma.legalChunk.findMany({ take: 500, include: { document: true } });
    const candidateIds = new Set(candidates.map((c) => c.id));
    const coppChunks = await prisma.legalChunk.findMany({
      where: {
        document: {
          OR: [
            { path: { contains: 'codigo-organico-procesal-penal', mode: 'insensitive' } },
            { name: { contains: 'codigo-organico-procesal-penal', mode: 'insensitive' } },
          ],
        },
      },
      take: 300,
      include: { document: true },
    });
    for (const chunk of coppChunks) {
      if (!candidateIds.has(chunk.id)) {
        candidates.push(chunk);
        candidateIds.add(chunk.id);
      }
    }
    const jurisChunks = await prisma.legalChunk.findMany({
      where: { sourceType: { in: ['jurisprudence', 'format'] } },
      take: 400,
      include: { document: true },
    });
    for (const chunk of jurisChunks) {
      if (!candidateIds.has(chunk.id)) {
        candidates.push(chunk);
        candidateIds.add(chunk.id);
      }
    }

    const queryEmbedding = await getEmbedding(ragQuery);
    const canUseEmbeddings = queryEmbedding && candidates.some((c) => c.embedding && c.embedding.length > 0);
    let scored;
    if (canUseEmbeddings) {
      scored = candidates
        .filter((c) => c.embedding && c.embedding.length > 0)
        .map((chunk) => ({
          chunk,
          score: cosineSimilarity(queryEmbedding, bufferToFloat32Array(chunk.embedding)),
        }))
        .filter((e) => e.score > 0);
    } else {
      const queryTokens = tokenize(ragQuery);
      scored = candidates
        .map((chunk) => ({ chunk, score: jaccardSimilarity(queryTokens, tokenize(chunk.text)) }))
        .filter((e) => e.score > 0);
    }
    scored.sort((a, b) => {
      const aNorm = NORMATIVE_SOURCE_TYPES.has(a.chunk.sourceType);
      const bNorm = NORMATIVE_SOURCE_TYPES.has(b.chunk.sourceType);
      if (aNorm !== bNorm) return aNorm ? -1 : 1;
      return b.score - a.score;
    });
    const topEntries = scored.slice(0, MAESTRO_DEBATE_TOP_CHUNKS);
    const chunksContext = topEntries
      .map((entry, i) => {
        const d = entry.chunk.document;
        const name = d?.name || d?.path || 'norma';
        const art = entry.chunk.article;
        const ref = art ? `Art. ${art} ${name}` : name;
        return `[${i + 1}] ${ref}\n${(entry.chunk.text || '').trim().slice(0, RAG_CHUNK_CHAR_LIMIT)}`;
      })
      .join('\n\n---\n\n');

    const analisisDocumento = await getAnalisisDocumentoResponse(documentText, question, chunksContext);
    if (!analisisDocumento) {
      return res.status(500).json({ error: 'No se pudo generar el análisis. Verifique OPENAI_API_KEY.' });
    }
    return res.json({
      id: null,
      abstained: false,
      threshold: 0.1,
      brief: { analisisDocumento },
      results: topEntries.map((entry, index) => ({
        id: entry.chunk.id,
        documentId: entry.chunk.documentId,
        article: entry.chunk.article,
        section: entry.chunk.section,
        text: entry.chunk.text,
        similarity: entry.score,
        rank: index + 1,
        sourceType: entry.chunk.sourceType,
        hierarchyRank: entry.chunk.hierarchyRank,
        passedThreshold: true,
        document: entry.chunk.document
          ? {
              id: entry.chunk.document.id,
              name: entry.chunk.document.name,
              path: entry.chunk.document.path,
              sourceType: entry.chunk.document.sourceType,
              hierarchyRank: entry.chunk.document.hierarchyRank,
              system: entry.chunk.document.system,
              organ: entry.chunk.document.organ,
            }
          : {},
      })),
    });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande (máx. 10 MB).' });
    }
    console.error('RAG /analisis-documento error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    next(err);
  }
});

/** POST /api/rag/export/formatos/docx — body: { formatosDocument: { heading?, identification?, facts?, legalBasis?, petition?, dateSignature? } } */
router.post('/export/formatos/docx', requireAuth, async (req, res, next) => {
  try {
    const doc = req.body?.formatosDocument;
    if (!doc || typeof doc !== 'object') {
      return res.status(400).json({ error: 'Se requiere formatosDocument en el body.' });
    }
    const { heading, identification, facts, legalBasis, petition, dateSignature } = doc || {};
    const coreFields = [heading, identification, facts, legalBasis, petition, dateSignature];
    const hasEmptyCore = coreFields.some(
      (v) => !v || typeof v !== 'string' || !v.trim() || v.trim() === '—',
    );
    const hasLegalMarkers =
      typeof legalBasis === 'string' &&
      /art\.|artículo|crbv|copp|código penal|codigo penal/i.test(legalBasis);
    if (hasEmptyCore || !hasLegalMarkers) {
      return res.status(400).json({
        error:
          'El escrito generado presenta insuficiencia o inconsistencias en su fundamentación (hechos, base legal o petitorio). Revise y corrija la información antes de exportar.',
      });
    }
    const buffer = await buildDocxBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="documento-penal.docx"');
    res.send(buffer);
  } catch (err) {
    console.error('Export formatos docx error:', err?.message || err);
    next(err);
  }
});

/** POST /api/rag/export/formatos/pdf — body: { formatosDocument: { heading?, identification?, facts?, legalBasis?, petition?, dateSignature? } } */
router.post('/export/formatos/pdf', requireAuth, async (req, res, next) => {
  try {
    const doc = req.body?.formatosDocument;
    if (!doc || typeof doc !== 'object') {
      return res.status(400).json({ error: 'Se requiere formatosDocument en el body.' });
    }
    const { heading, identification, facts, legalBasis, petition, dateSignature } = doc || {};
    const coreFields = [heading, identification, facts, legalBasis, petition, dateSignature];
    const hasEmptyCore = coreFields.some(
      (v) => !v || typeof v !== 'string' || !v.trim() || v.trim() === '—',
    );
    const hasLegalMarkers =
      typeof legalBasis === 'string' &&
      /art\.|artículo|crbv|copp|código penal|codigo penal/i.test(legalBasis);
    if (hasEmptyCore || !hasLegalMarkers) {
      return res.status(400).json({
        error:
          'El escrito generado presenta insuficiencia o inconsistencias en su fundamentación (hechos, base legal o petitorio). Revise y corrija la información antes de exportar.',
      });
    }
    const buffer = await buildPdfBuffer(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento-penal.pdf"');
    res.send(buffer);
  } catch (err) {
    console.error('Export formatos pdf error:', err?.message || err);
    next(err);
  }
});

export default router;

