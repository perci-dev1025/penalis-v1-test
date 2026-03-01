-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('individual', 'pro', 'institutional');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('fundamental_norm', 'special_penal_law', 'jurisprudence', 'doctrine', 'treaty', 'format');

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlanType" NOT NULL,
    "maxActiveSessions" INTEGER NOT NULL,
    "maxQueriesPerMonth" INTEGER,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "ActiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "hierarchyRank" INTEGER NOT NULL,
    "system" TEXT,
    "organ" TEXT,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "article" TEXT,
    "section" TEXT,
    "text" TEXT NOT NULL,
    "embedding" BYTEA,
    "sourceType" "SourceType" NOT NULL,
    "hierarchyRank" INTEGER NOT NULL,

    CONSTRAINT "LegalChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Query" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "planId" TEXT,
    "mode" TEXT,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "similarityThreshold" DOUBLE PRECISION NOT NULL,
    "abstained" BOOLEAN NOT NULL,

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuerySource" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "QuerySource_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveSession" ADD CONSTRAINT "ActiveSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalChunk" ADD CONSTRAINT "LegalChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Query" ADD CONSTRAINT "Query_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuerySource" ADD CONSTRAINT "QuerySource_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuerySource" ADD CONSTRAINT "QuerySource_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "LegalChunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
