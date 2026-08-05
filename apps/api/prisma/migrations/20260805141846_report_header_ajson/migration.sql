-- AlterTable
ALTER TABLE "EntryReport" ADD COLUMN "cumTimeLogDays" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "daysLti" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "endDepthTvd" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "hazards" TEXT;
ALTER TABLE "EntryReport" ADD COLUMN "headCount" REAL;

-- AlterTable
ALTER TABLE "EntryWell" ADD COLUMN "client" TEXT;
ALTER TABLE "EntryWell" ADD COLUMN "comment" TEXT;
ALTER TABLE "EntryWell" ADD COLUMN "elevationNote" TEXT;
ALTER TABLE "EntryWell" ADD COLUMN "latitude" TEXT;
ALTER TABLE "EntryWell" ADD COLUMN "longitude" TEXT;
