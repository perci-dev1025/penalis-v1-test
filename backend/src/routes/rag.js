import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getEmbedding } from '../rag/embeddingProvider.js';

const router = Router();

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

const PROCEDURAL_BOOST = 0.15;
const SUBSTANTIVE_PENAL_PENALTY = 0.12;

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

router.post('/query', requireAuth, async (req, res, next) => {
  try {
    const { question, mode, limit } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res
        .status(400)
        .json({ error: 'La pregunta (question) es requerida.' });
    }

    const maxResults = Number.isFinite(limit) ? Math.min(limit, 50) : 10;
    const threshold = getThresholdForMode(mode);

    const candidates = await prisma.legalChunk.findMany({
      take: 500,
      include: { document: true },
    });

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
    const proceduralQuery = isProceduralQuery(question);
    if (proceduralQuery) {
      for (const entry of scored) {
        const doc = entry.chunk.document;
        const path = doc?.path ?? '';
        const name = doc?.name ?? '';
        if (isProceduralDocument(path, name)) {
          entry.score += PROCEDURAL_BOOST;
        }
        if (isSubstantiveOnlyPenal(path, name)) {
          entry.score = Math.max(0, entry.score - SUBSTANTIVE_PENAL_PENALTY);
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

    scored = scored.slice(0, maxResults);

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

    const modeLower = String(mode || '').toLowerCase();
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

    return res.json({
      id: createdQuery.id,
      abstained,
      threshold,
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

export default router;

