-- CreateTable
CREATE TABLE "Audience" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audience_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Experiment" ADD COLUMN "audienceId" TEXT;

-- CreateIndex
CREATE INDEX "Experiment_audienceId_idx" ON "Experiment"("audienceId");

-- CreateIndex
CREATE UNIQUE INDEX "Audience_name_environmentId_key" ON "Audience"("name", "environmentId");

-- AddForeignKey
ALTER TABLE "Audience" ADD CONSTRAINT "Audience_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE SET NULL ON UPDATE CASCADE;
