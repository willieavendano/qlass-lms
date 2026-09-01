-- Alpha pilot features (PR #13): email digest bookkeeping + AI reviewer output.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "review" JSONB;
