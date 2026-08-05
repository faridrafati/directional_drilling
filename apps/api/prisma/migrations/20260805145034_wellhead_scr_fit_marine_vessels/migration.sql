-- AlterTable
ALTER TABLE "EntryCasingRun" ADD COLUMN "com" TEXT;
ALTER TABLE "EntryCasingRun" ADD COLUMN "runDate" TEXT;
ALTER TABLE "EntryCasingRun" ADD COLUMN "topMkb" REAL;

-- CreateTable
CREATE TABLE "EntryWellheadComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "installDate" TEXT,
    "sizeIn" REAL,
    "type" TEXT,
    "make" TEXT,
    "wpPsi" REAL,
    "com" TEXT,
    CONSTRAINT "EntryWellheadComponent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryScrRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pumpNo" TEXT,
    "depthMkb" REAL,
    "strokesSpm" REAL,
    "effPct" REAL,
    "pPsi" REAL,
    "qFlowGpm" REAL,
    CONSTRAINT "EntryScrRate_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntrySupportVessel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "vesselName" TEXT,
    "vesselType" TEXT,
    "arrivalDate" TEXT,
    "departureDate" TEXT,
    "note" TEXT,
    CONSTRAINT "EntrySupportVessel_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryFit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "testType" TEXT,
    "testDate" TEXT,
    "lastCasingStringRun" TEXT,
    "depthMkb" REAL,
    "tvdMkb" REAL,
    "appliedSurfacePressurePsi" REAL,
    "fluidDensityPpg" REAL,
    "volumePumpedBbl" REAL,
    "leakOffPressurePsi" REAL,
    "leakOffEqDensityPpg" REAL,
    CONSTRAINT "EntryFit_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryMarine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "swellHtM" REAL,
    "visibilityKm" REAL,
    "windDir" TEXT,
    "windSpdKnots" REAL,
    "tHighC" REAL,
    "waveHtM" REAL,
    "com" TEXT,
    CONSTRAINT "EntryMarine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EntryWellheadComponent_reportId_order_idx" ON "EntryWellheadComponent"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryScrRate_reportId_order_idx" ON "EntryScrRate"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntrySupportVessel_reportId_order_idx" ON "EntrySupportVessel"("reportId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "EntryFit_reportId_key" ON "EntryFit"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "EntryMarine_reportId_key" ON "EntryMarine"("reportId");
