-- AlterTable
ALTER TABLE "EntryFormationTop" ADD COLUMN "drilledRopMHr" REAL;
ALTER TABLE "EntryFormationTop" ADD COLUMN "finalTopTvd" REAL;
ALTER TABLE "EntryFormationTop" ADD COLUMN "lithDes" TEXT;
ALTER TABLE "EntryFormationTop" ADD COLUMN "progTopMd" REAL;
ALTER TABLE "EntryFormationTop" ADD COLUMN "thickM" REAL;

-- AlterTable
ALTER TABLE "EntryReport" ADD COLUMN "opsAtReportTime" TEXT;
ALTER TABLE "EntryReport" ADD COLUMN "opsNextPeriod" TEXT;

-- CreateTable
CREATE TABLE "EntrySupervisor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "jobContact" TEXT,
    "position" TEXT,
    CONSTRAINT "EntrySupervisor_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryOnboardCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "count" INTEGER,
    "note" TEXT,
    CONSTRAINT "EntryOnboardCompany_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryHseDrill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT,
    "daysToNextCheck" REAL,
    CONSTRAINT "EntryHseDrill_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryBulkMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "supplyItemDes" TEXT,
    "unitLabel" TEXT,
    "consumed" REAL,
    "received" REAL,
    "returned" REAL,
    "onLoc" REAL,
    "note" TEXT,
    CONSTRAINT "EntryBulkMaterial_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EntrySupervisor_reportId_order_idx" ON "EntrySupervisor"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryOnboardCompany_reportId_order_idx" ON "EntryOnboardCompany"("reportId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "EntryHseDrill_reportId_type_key" ON "EntryHseDrill"("reportId", "type");

-- CreateIndex
CREATE INDEX "EntryBulkMaterial_reportId_order_idx" ON "EntryBulkMaterial"("reportId", "order");
