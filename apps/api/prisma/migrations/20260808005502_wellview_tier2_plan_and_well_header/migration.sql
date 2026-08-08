-- AlterTable
ALTER TABLE "EntryWell" ADD COLUMN "area" TEXT;
ALTER TABLE "EntryWell" ADD COLUMN "county" TEXT;
ALTER TABLE "EntryWell" ADD COLUMN "ewDistance" REAL;
ALTER TABLE "EntryWell" ADD COLUMN "ewRef" TEXT;
ALTER TABLE "EntryWell" ADD COLUMN "nsDistance" REAL;
ALTER TABLE "EntryWell" ADD COLUMN "nsRef" TEXT;

-- CreateTable
CREATE TABLE "WellPlanStation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "md" REAL,
    "inc" REAL,
    "azi" REAL,
    "tvd" REAL,
    "ns" REAL,
    "ew" REAL,
    "vs" REAL,
    "dls" REAL,
    "comment" TEXT,
    CONSTRAINT "WellPlanStation_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WellPlanStation_wellId_order_idx" ON "WellPlanStation"("wellId", "order");
