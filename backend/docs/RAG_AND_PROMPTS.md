# RAG and prompt maestro — internal reference

This document answers three review points in one place: how the corpus is queried, how the prompt is built, and where the “prompt maestro” (per-mode system prompts) lives.

---

## 1. How the corpus is queried

**Entry point:** `POST /api/rag/query` in `src/routes/rag.js`.

- **Candidates:** Chunks are loaded from the database (`LegalChunk` with related `Document`). When the query mentions COPP, is in debate mode, or is detected as procedural, additional COPP chunks are fetched and merged into the candidate set.

- **Similarity:**
  - If the query has an embedding and candidates have embeddings: **cosine similarity** between query embedding and each chunk embedding is used.
  - Otherwise: **Jaccard similarity** on tokenized text (query vs. chunk text).
  - COPP chunks without embeddings can be scored by Jaccard when COPP is relevant.

- **Ordering and filtering:**
  - Normative source types (Constitution, special penal law, treaty) are prioritised over non-normative.
  - Optional boosts/penalties (e.g. procedural query, explicit COPP mention, debate mode) adjust scores so COPP/procedural docs rank appropriately.
  - In debate mode, a minimum number of COPP chunks can be blended into the top results.
  - Scores are sorted; then the list is cut to `maxResults` (from request `limit` or default 10).

- **Threshold:** Per-mode similarity threshold is applied via `getThresholdForMode(mode)`. Environment variables: `RAG_SIMILARITY_THRESHOLD_DEFAULT`, `RAG_SIMILARITY_THRESHOLD_AUDIENCIA`, `RAG_SIMILARITY_THRESHOLD_CONSULTA`, `RAG_SIMILARITY_THRESHOLD_DEBATE`, `RAG_SIMILARITY_THRESHOLD_FORMATOS`. Chunks with score ≥ threshold are “passing”. The system abstains when no **normative** chunk is passing (so the user sees an abstention message).

- **Context sent to the LLM:** From the scored list, the top **N** chunks are taken (`N = MAESTRO_DEBATE_TOP_CHUNKS`, default 15, env `RAG_MAESTRO_TOP_CHUNKS`). Each chunk’s text is truncated to **RAG_CHUNK_CHAR_LIMIT** (default 1200, env `RAG_CHUNK_CHAR_LIMIT`) and formatted with a reference (e.g. “Art. X document name”). These strings are joined with a separator into a single **chunksContext** string. The same context-building logic is used for Consulta, Audiencia, Debate, and Formatos; only the mode-specific prompt and LLM call differ.

---

## 2. How the prompt is built

For each mode, the LLM is invoked with:

1. **System prompt:** The “prompt maestro” for that mode (see section 3). It defines role, structure, output format (e.g. JSON keys), and rules (e.g. abstention, hierarchy, no invention of sources).

2. **User message:** Built by the mode’s `build*UserMessage(...)` function. It receives the user’s question and the **chunksContext** (the retrieved excerpts string). When applicable it also receives the procedural role (defensa/fiscal). The instructions tell the model to ground the answer only in the provided context.

No other corpus metadata (e.g. similarity scores, internal IDs) is sent in the prompt. The model sees only the question and the excerpt text (and role when relevant).

---

## 3. Where the prompt maestro lives

Each mode has a system prompt and a user-message builder in a dedicated file under `src/rag/`:

| Mode      | File                     | System constant              | User message builder                          |
|-----------|--------------------------|------------------------------|-----------------------------------------------|
| Consulta  | `promptConsulta.js`      | `PROMPT_CONSULTA_SYSTEM`     | `buildConsultaUserMessage(question, chunksContext)` |
| Audiencia | `promptMaestro.js`       | `PROMPT_MAESTRO_SYSTEM`      | `buildMaestroUserMessage(role, question, chunksContext)` |
| Debate    | `promptMasterDebate.js`  | `PROMPT_MASTER_DEBATE_SYSTEM`| `buildDebateMasterUserMessage(role, question, chunksContext)` |
| Formatos  | `promptFormatos.js`      | `PROMPT_FORMATOS_SYSTEM`     | `buildFormatosUserMessage(question, chunksContext)` |

The LLM provider (`src/rag/llmProvider.js`) imports these and calls the external LLM with the system prompt and the built user message for the requested mode.

---

## Optional: retrieval debug logging

To log retrieval context (number of chunks, total `chunksContext` length, and document/source types) for each request, set in the environment:

- `RAG_DEBUG=1` or `RAG_DEBUG=true`

Logging is performed in `src/routes/rag.js` via `logRagContext()` and is disabled when `RAG_DEBUG` is not set. Disable (or leave unset) in production.
