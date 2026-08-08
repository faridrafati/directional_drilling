-- AlterTable
ALTER TABLE "EntryReport" ADD COLUMN "avgBackgroundGasPct" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "avgConnectionGasPct" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "avgDrillGasPct" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "avgTripGasPct" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "geoActivityAtReportTime" TEXT;
ALTER TABLE "EntryReport" ADD COLUMN "geoOpsNextPeriod" TEXT;
ALTER TABLE "EntryReport" ADD COLUMN "geoOpsThisPeriod" TEXT;
ALTER TABLE "EntryReport" ADD COLUMN "maxBackgroundGasPct" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "maxConnectionGasPct" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "maxDrillGasPct" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "maxTripGasPct" REAL;

-- CreateTable
CREATE TABLE "WellFormation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "lithDes" TEXT,
    "elementType" TEXT,
    "layerName" TEXT,
    "progDepthTopSs" REAL,
    "progTopTvd" REAL,
    "progDepthBtmSs" REAL,
    "progBtmTvd" REAL,
    "drillTopMd" REAL,
    "drillTopTvd" REAL,
    "drillBtmMd" REAL,
    "drillBtmTvd" REAL,
    "finalTopMd" REAL,
    "finalBtmMd" REAL,
    "ropMHr" REAL,
    "pPorePpg" REAL,
    "pFracPpg" REAL,
    "temperatureC" REAL,
    "h2sConcPct" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WellFormation_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeoSamplingRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "topDes" TEXT,
    "topMkb" REAL,
    "btmDes" TEXT,
    "btmMkb" REAL,
    "rqdBy" TEXT,
    "sampledBy" TEXT,
    "com" TEXT,
    CONSTRAINT "GeoSamplingRequirement_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeoSamplingRequirement_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT,
    "contactName" TEXT,
    "title" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "note" TEXT,
    CONSTRAINT "JobContact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntrySampleDescription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "topMkb" REAL,
    "btmMkb" REAL,
    "volCaPct" REAL,
    "volMgPct" REAL,
    "com" TEXT,
    CONSTRAINT "EntrySampleDescription_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryLithology" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "topMkb" REAL,
    "btmMkb" REAL,
    "des" TEXT,
    "volPct" REAL,
    "type" TEXT,
    "typeCode" TEXT,
    CONSTRAINT "EntryLithology_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryShow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT,
    "topMkb" REAL,
    "btmMkb" REAL,
    "showQuality" TEXT,
    "showOrigin" TEXT,
    "showType" TEXT,
    "totalGasAvgPct" REAL,
    "totalGasMinPct" REAL,
    "totalGasMaxPct" REAL,
    CONSTRAINT "EntryShow_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryLogRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "time" TEXT,
    "runNo" TEXT,
    "type" TEXT,
    "topMkb" REAL,
    "btmMkb" REAL,
    "loggingCompany" TEXT,
    CONSTRAINT "EntryLogRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WellFormation_wellId_order_idx" ON "WellFormation"("wellId", "order");

-- CreateIndex
CREATE INDEX "GeoSamplingRequirement_wellId_order_idx" ON "GeoSamplingRequirement"("wellId", "order");

-- CreateIndex
CREATE INDEX "JobContact_jobId_order_idx" ON "JobContact"("jobId", "order");

-- CreateIndex
CREATE INDEX "EntrySampleDescription_reportId_order_idx" ON "EntrySampleDescription"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryLithology_reportId_order_idx" ON "EntryLithology"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryShow_reportId_order_idx" ON "EntryShow"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryLogRun_reportId_order_idx" ON "EntryLogRun"("reportId", "order");
