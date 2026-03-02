import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getEmbedding } from '../rag/embeddingProvider.js';
import { getMaestroResponse, getDebateMasterResponse } from '../rag/llmProvider.js';

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

    // PROMPT MAESTRO: for audiencia mode with normative support, call LLM for 6-section tactical analysis.
    if (
      modeLower === 'audiencia' &&
      brief &&
      !abstained &&
      scored.length > 0
    ) {
      const topChunks = scored.slice(0, 10).map((entry, i) => {
        const d = entry.chunk.document;
        const name = d?.name || d?.path || 'norma';
        const art = entry.chunk.article;
        const ref = art ? `Art. ${art} ${name}` : name;
        return `[${i + 1}] ${ref}\n${entry.chunk.text?.trim().slice(0, 800) ?? ''}`;
      });
      const chunksContext = topChunks.join('\n\n---\n\n');
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
      const topChunks = scored.slice(0, 10).map((entry, i) => {
        const d = entry.chunk.document;
        const name = d?.name || d?.path || 'norma';
        const art = entry.chunk.article;
        const ref = art ? `Art. ${art} ${name}` : name;
        return `[${i + 1}] ${ref}\n${entry.chunk.text?.trim().slice(0, 800) ?? ''}`;
      });
      const chunksContext = topChunks.join('\n\n---\n\n');
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

