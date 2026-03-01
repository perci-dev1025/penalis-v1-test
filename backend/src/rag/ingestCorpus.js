import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../db.js';
import { getEmbedding } from './embeddingProvider.js';

const corpusRoot = path.resolve(process.cwd(), 'data', 'corpus');

function mapTopFolder(topFolder) {
  if (topFolder.startsWith('01_')) {
    return { sourceType: 'fundamental_norm', hierarchyRank: 1 };
  }
  if (topFolder.startsWith('02_')) {
    return { sourceType: 'special_penal_law', hierarchyRank: 2 };
  }
  if (topFolder.startsWith('03_')) {
    return { sourceType: 'jurisprudence', hierarchyRank: 3 };
  }
  if (topFolder.startsWith('04_')) {
    return { sourceType: 'doctrine', hierarchyRank: 4 };
  }
  if (topFolder.startsWith('05_')) {
    return { sourceType: 'treaty', hierarchyRank: 2 };
  }
  if (topFolder.startsWith('06_')) {
    return { sourceType: 'format', hierarchyRank: 5 };
  }
  return null;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function splitIntoChunks(raw) {
  const lines = raw.split(/\r?\n/);
  const chunks = [];
  let currentArticle = null;
  let buffer = [];

  const articleRegex = /^(Artículo|Art\.?|ART[ÍI]CULO)\s+(\d+)[\s.:,-]?/i;

  for (const line of lines) {
    const match = line.match(articleRegex);
    if (match) {
      if (buffer.length > 0 && currentArticle !== null) {
        chunks.push({
          article: currentArticle,
          text: buffer.join('\n').trim(),
        });
      } else if (buffer.length > 0) {
        chunks.push({
          article: null,
          text: buffer.join('\n').trim(),
        });
      }
      currentArticle = match[2] ?? match[0];
      buffer = [line];
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length > 0) {
    chunks.push({
      article: currentArticle,
      text: buffer.join('\n').trim(),
    });
  }

  return chunks.filter((c) => c.text.length > 0);
}

async function ingestFile(filePath) {
  if (!filePath.toLowerCase().endsWith('.txt')) {
    return;
  }

  const relativePath = path.relative(corpusRoot, filePath);
  const segments = relativePath.split(path.sep);
  const [topFolder, maybeSubfolder] = segments;
  const mapping = mapTopFolder(topFolder);
  if (!mapping) {
    return;
  }

  const system =
    mapping.sourceType === 'treaty' && maybeSubfolder ? maybeSubfolder : null;
  const organ =
    mapping.sourceType === 'jurisprudence' && maybeSubfolder ? maybeSubfolder : null;

  const name = path.basename(filePath, path.extname(filePath));

  const existing = await prisma.legalDocument.findFirst({
    where: { path: relativePath },
  });
  if (existing) {
    return;
  }

  const raw = await fs.readFile(filePath, 'utf8');
  const chunks = splitIntoChunks(raw);

  if (chunks.length === 0) {
    return;
  }

  const created = await prisma.legalDocument.create({
    data: {
      sourceType: mapping.sourceType,
      hierarchyRank: mapping.hierarchyRank,
      system,
      organ,
      name,
      path: relativePath,
      chunks: {
        create: chunks.map((chunk) => ({
          article: chunk.article,
          section: null,
          text: chunk.text,
          sourceType: mapping.sourceType,
          hierarchyRank: mapping.hierarchyRank,
        })),
      },
    },
    include: {
      chunks: true,
    },
  });

  const providerEnabled =
    (process.env.RAG_EMBEDDING_PROVIDER || 'none') !== 'none';

  if (!providerEnabled) {
    return;
  }

  // Attach embeddings to each chunk, if possible.
  for (const chunk of created.chunks) {
    try {
      const embeddingVec = await getEmbedding(chunk.text);
      if (!embeddingVec) continue;
      const embeddingBuffer = Buffer.from(embeddingVec.buffer);
      await prisma.legalChunk.update({
        where: { id: chunk.id },
        data: { embedding: embeddingBuffer },
      });
    } catch (err) {
      console.error(
        'Error generating embedding for chunk',
        created.id,
        chunk.id,
        err.message,
      );
    }
  }
}

async function main() {
  console.log('Ingesting corpus from', corpusRoot);
  const files = await walk(corpusRoot);
  for (const file of files) {
    try {
      await ingestFile(file);
    } catch (err) {
      console.error('Error ingesting file', file, err.message);
    }
  }
  console.log('Corpus ingestion completed');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  // eslint-disable-next-line no-process-exit
  process.exit(1);
});

