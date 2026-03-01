const provider = process.env.RAG_EMBEDDING_PROVIDER || 'none';
const openaiModel =
  process.env.RAG_EMBEDDING_MODEL || 'text-embedding-3-large';
const openaiApiKey = process.env.OPENAI_API_KEY;

let warnedNoApiKey = false;

export async function getEmbedding(text) {
  if (provider !== 'openai') {
    return null;
  }
  if (!openaiApiKey) {
    if (!warnedNoApiKey) {
      console.error(
        'OPENAI_API_KEY is not set; skipping embedding generation. Set RAG_EMBEDDING_PROVIDER=openai and OPENAI_API_KEY in .env to enable.',
      );
      warnedNoApiKey = true;
    }
    return null;
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openaiModel,
      input: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(
      'Failed to generate embedding from OpenAI:',
      res.status,
      body,
    );
    return null;
  }

  const json = await res.json();
  const vector = json?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    console.error('Unexpected embedding response shape from OpenAI');
    return null;
  }

  return new Float32Array(vector);
}

