import {
  PROMPT_MAESTRO_SYSTEM,
  buildMaestroUserMessage,
} from './promptMaestro.js';
import {
  PROMPT_MASTER_DEBATE_SYSTEM,
  buildDebateMasterUserMessage,
} from './promptMasterDebate.js';

const openaiApiKey = process.env.OPENAI_API_KEY;
const model = process.env.RAG_MAESTRO_MODEL || 'gpt-4o-mini';

let warnedNoApiKey = false;

/** Convert camelCase to snake_case for LLM response key fallback. */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function getString(parsed, camelKey) {
  const val = parsed[camelKey];
  if (val != null && typeof val === 'string') return val.trim();
  const snakeKey = camelToSnake(camelKey);
  const snakeVal = parsed[snakeKey];
  if (snakeVal != null && typeof snakeVal === 'string') return snakeVal.trim();
  return '';
}

/**
 * Call OpenAI chat completions with PROMPT MAESTRO and return parsed 6-section object.
 * @param {string} role - 'defensa' | 'fiscal' | null
 * @param {string} question - User question
 * @param {string} chunksContext - Concatenated legal context from RAG chunks
 * @returns {Promise<{ applicableLegalFramework, proceduralTechnicalAnalysis, oralInterventionStrategy, strategicWeakness, proceduralRisks, immediateTacticalRecommendation } | null>}
 */
export async function getMaestroResponse(role, question, chunksContext) {
  if (!openaiApiKey) {
    if (!warnedNoApiKey) {
      console.error(
        'OPENAI_API_KEY is not set; PROMPT MAESTRO (Hearing Mode) will not run. Set OPENAI_API_KEY in .env.',
      );
      warnedNoApiKey = true;
    }
    return null;
  }

  const userMessage = buildMaestroUserMessage(role, question, chunksContext);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: PROMPT_MAESTRO_SYSTEM },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('PROMPT MAESTRO LLM error:', res.status, text);
    return null;
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    console.error('PROMPT MAESTRO: empty or invalid response');
    return null;
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : content;
  try {
    const parsed = JSON.parse(jsonStr);
    const keys = [
      'applicableLegalFramework',
      'proceduralTechnicalAnalysis',
      'oralInterventionStrategy',
      'strategicWeakness',
      'proceduralRisks',
      'immediateTacticalRecommendation',
    ];
    const result = {};
    for (const k of keys) {
      result[k] = getString(parsed, k);
    }
    return result;
  } catch (e) {
    console.error('PROMPT MAESTRO: failed to parse JSON', e.message);
    return null;
  }
}

const debateModel = process.env.RAG_DEBATE_MASTER_MODEL || process.env.RAG_MAESTRO_MODEL || 'gpt-4o-mini';

/**
 * Call OpenAI chat with PROMPT MASTER SUPERIOR (Debate Mode) and return parsed 9-section object.
 */
export async function getDebateMasterResponse(role, question, chunksContext) {
  if (!openaiApiKey) {
    if (!warnedNoApiKey) {
      console.error(
        'OPENAI_API_KEY is not set; PROMPT MASTER SUPERIOR (Debate Mode) will not run.',
      );
      warnedNoApiKey = true;
    }
    return null;
  }

  const userMessage = buildDebateMasterUserMessage(role, question, chunksContext);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: debateModel,
      messages: [
        { role: 'system', content: PROMPT_MASTER_DEBATE_SYSTEM },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('PROMPT MASTER SUPERIOR (Debate) LLM error:', res.status, text);
    return null;
  }

  const json = await res.json();
  let content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    console.error('PROMPT MASTER SUPERIOR (Debate): empty or invalid response');
    return null;
  }

  // Strip markdown code fence if present so JSON.parse succeeds
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : content;

  try {
    const parsed = JSON.parse(jsonStr);
    const keys = [
      'identificationOfOpposingThesis',
      'applicableLegalFramework',
      'evidentiaryAnalysis',
      'structuralLegalRefutation',
      'detectedVulnerability',
      'counterattackStrategy',
      'possibleCounterargumentOfOpposingParty',
      'recommendedPreventiveResponse',
      'proceduralRisks',
    ];
    const result = {};
    for (const k of keys) {
      result[k] = getString(parsed, k);
    }
    return result;
  } catch (e) {
    console.error('PROMPT MASTER SUPERIOR (Debate): failed to parse JSON', e.message);
    return null;
  }
}
