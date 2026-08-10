-- AlterTable
ALTER TABLE "EntryWellbore" ADD COLUMN "apiUwi" TEXT;
ALTER TABLE "EntryWellbore" ADD COLUMN "btmLocation" TEXT;
ALTER TABLE "EntryWellbore" ADD COLUMN "parentWellboreId" TEXT;

-- AlterTable
ALTER TABLE "EntryWellheadComponent" ADD COLUMN "btmConnectionType" TEXT;
ALTER TABLE "EntryWellheadComponent" ADD COLUMN "btmSizeIn" REAL;
ALTER TABLE "EntryWellheadComponent" ADD COLUMN "des" TEXT;
ALTER TABLE "EntryWellheadComponent" ADD COLUMN "section" TEXT;
ALTER TABLE "EntryWellheadComponent" ADD COLUMN "topConnectionType" TEXT;
ALTER TABLE "EntryWellheadComponent" ADD COLUMN "topSizeIn" REAL;
