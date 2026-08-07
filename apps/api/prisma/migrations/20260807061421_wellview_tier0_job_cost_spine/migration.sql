-- AlterTable
ALTER TABLE "EntryOperation" ADD COLUMN "opDetail" TEXT;
ALTER TABLE "EntryOperation" ADD COLUMN "opLetter" TEXT;
ALTER TABLE "EntryOperation" ADD COLUMN "timeIndicator" TEXT;

-- AlterTable
ALTER TABLE "EntryWell" ADD COLUMN "apiUwi" TEXT;
ALTER TABLE "EntryWell" ADD COLUMN "casingFlangeElevation" REAL;
ALTER TABLE "EntryWell" ADD COLUMN "groundElevation" REAL;
ALTER TABLE "EntryWell" ADD COLUMN "kbCasingFlangeDistance" REAL;
ALTER TABLE "EntryWell" ADD COLUMN "kbGroundDistance" REAL;
ALTER TABLE "EntryWell" ADD COLUMN "licenseNo" TEXT;
ALTER TABLE "EntryWell" ADD COLUMN "stateProvince" TEXT;

-- CreateTable
CREATE TABLE "WvMainOperation" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "matrixLabel" TEXT,
    "onMatrix" BOOLEAN NOT NULL DEFAULT true,
    "riglessOnly" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "WvOperationDetail" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "num" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "definition" TEXT,
    "onMatrix" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "WvMatrixCell" (
    "letter" TEXT NOT NULL,
    "detailNum" INTEGER NOT NULL,
    "note" TEXT,

    PRIMARY KEY ("letter", "detailNum"),
    CONSTRAINT "WvMatrixCell_letter_fkey" FOREIGN KEY ("letter") REFERENCES "WvMainOperation" ("code") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WvMatrixCell_detailNum_fkey" FOREIGN KEY ("detailNum") REFERENCES "WvOperationDetail" ("num") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WvTimeIndicator" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "definition" TEXT,
    "order" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "WvReportCode" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "WvWorkingPhase" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "startsAt" TEXT,
    "endsAt" TEXT,
    "order" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "category" TEXT,
    "primaryJobType" TEXT,
    "secondaryJobType" TEXT,
    "status1" TEXT,
    "plannedStartDate" TEXT,
    "startDate" TEXT,
    "minPlannedEndDate" TEXT,
    "mostLikelyPlannedEndDate" TEXT,
    "maxPlannedEndDate" TEXT,
    "endDate" TEXT,
    "targetDepth" REAL,
    "targetFormation" TEXT,
    "summary" TEXT,
    "possCostSave" REAL,
    "possTimeSaveHr" REAL,
    "estProblemCost" REAL,
    "estLostTimeHr" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "phaseType1" TEXT,
    "phaseType2" TEXT,
    "actualStartDate" TEXT,
    "actualEndDate" TEXT,
    "actualStartDepth" REAL,
    "actualEndDepth" REAL,
    "workingPhaseCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobPhase_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobPhasePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobPhaseId" TEXT NOT NULL,
    "startDepth" REAL,
    "endDepth" REAL,
    "durMostLikelyDays" REAL,
    "costMostLikely" REAL,
    CONSTRAINT "JobPhasePlan_jobPhaseId_fkey" FOREIGN KEY ("jobPhaseId") REFERENCES "JobPhase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Afe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "afeNumber" TEXT,
    "description" TEXT,
    "amount" REAL,
    "approvedDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Afe_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AfeSupplement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "afeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "number" TEXT,
    "amount" REAL,
    "approvedDate" TEXT,
    CONSTRAINT "AfeSupplement_afeId_fkey" FOREIGN KEY ("afeId") REFERENCES "Afe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AfeLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "afeId" TEXT NOT NULL,
    "costCodeId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "amount" REAL,
    CONSTRAINT "AfeLine_afeId_fkey" FOREIGN KEY ("afeId") REFERENCES "Afe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AfeLine_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CostCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code1" TEXT NOT NULL,
    "code2" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "projectScope" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CostItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "phaseId" TEXT,
    "costCodeId" TEXT,
    "afeLineId" TEXT,
    "supplementId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "afeAmount" REAL,
    "suppAmount" REAL,
    "fieldEstimate" REAL,
    "finalInvoice" REAL,
    "category" TEXT,
    "costDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CostItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CostItem_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "JobPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostItem_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostItem_afeLineId_fkey" FOREIGN KEY ("afeLineId") REFERENCES "AfeLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostItem_supplementId_fkey" FOREIGN KEY ("supplementId") REFERENCES "AfeSupplement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EntryReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "reportDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "jobId" TEXT,
    "phaseId" TEXT,
    "morningDepth" REAL,
    "midnightDepth" REAL,
    "previousDepth" REAL,
    "endDepthTvd" REAL,
    "drillingTime" REAL,
    "cumDrillingTime" REAL,
    "cumTimeLogDays" REAL,
    "daysLti" REAL,
    "headCount" REAL,
    "hazards" TEXT,
    "holeSize" TEXT,
    "formation" TEXT,
    "lithology" TEXT,
    "lastCasing" TEXT,
    "linerLap" TEXT,
    "kop" TEXT,
    "wellSiteSupt" TEXT,
    "opnSupt" TEXT,
    "progEng" TEXT,
    "geologist" TEXT,
    "toolPusher1" TEXT,
    "toolPusher2" TEXT,
    "formationLoss" REAL,
    "mudLossUnit" REAL,
    "mudGains" REAL,
    "description" TEXT,
    "opsAtReportTime" TEXT,
    "opsNextPeriod" TEXT,
    "windSpeedDir" TEXT,
    "waveVisible" TEXT,
    "freshWater" REAL,
    "fuel" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    CONSTRAINT "EntryReport_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "EntryUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EntryReport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EntryReport_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "JobPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EntryReport" ("createdAt", "cumDrillingTime", "cumTimeLogDays", "daysLti", "description", "drillingTime", "endDepthTvd", "formation", "formationLoss", "freshWater", "fuel", "geologist", "hazards", "headCount", "holeSize", "id", "kop", "lastCasing", "linerLap", "lithology", "midnightDepth", "morningDepth", "mudGains", "mudLossUnit", "opnSupt", "opsAtReportTime", "opsNextPeriod", "previousDepth", "progEng", "reportDate", "serialNo", "status", "submittedAt", "toolPusher1", "toolPusher2", "updatedAt", "userId", "waveVisible", "wellId", "wellSiteSupt", "windSpeedDir") SELECT "createdAt", "cumDrillingTime", "cumTimeLogDays", "daysLti", "description", "drillingTime", "endDepthTvd", "formation", "formationLoss", "freshWater", "fuel", "geologist", "hazards", "headCount", "holeSize", "id", "kop", "lastCasing", "linerLap", "lithology", "midnightDepth", "morningDepth", "mudGains", "mudLossUnit", "opnSupt", "opsAtReportTime", "opsNextPeriod", "previousDepth", "progEng", "reportDate", "serialNo", "status", "submittedAt", "toolPusher1", "toolPusher2", "updatedAt", "userId", "waveVisible", "wellId", "wellSiteSupt", "windSpeedDir" FROM "EntryReport";
DROP TABLE "EntryReport";
ALTER TABLE "new_EntryReport" RENAME TO "EntryReport";
CREATE INDEX "EntryReport_wellId_status_idx" ON "EntryReport"("wellId", "status");
CREATE INDEX "EntryReport_userId_idx" ON "EntryReport"("userId");
CREATE INDEX "EntryReport_jobId_serialNo_idx" ON "EntryReport"("jobId", "serialNo");
CREATE INDEX "EntryReport_phaseId_idx" ON "EntryReport"("phaseId");
CREATE UNIQUE INDEX "EntryReport_wellId_reportDate_key" ON "EntryReport"("wellId", "reportDate");
CREATE UNIQUE INDEX "EntryReport_wellId_serialNo_key" ON "EntryReport"("wellId", "serialNo");
CREATE TABLE "new_EntryTimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "group" TEXT,
    "type" TEXT,
    "activity" TEXT,
    "hours" REAL,
    "opLetter" TEXT,
    "opDetail" TEXT,
    "timeIndicator" TEXT,
    "phaseId" TEXT,
    CONSTRAINT "EntryTimeEntry_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryTimeEntry_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "JobPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EntryTimeEntry" ("activity", "group", "hours", "id", "order", "reportId", "type") SELECT "activity", "group", "hours", "id", "order", "reportId", "type" FROM "EntryTimeEntry";
DROP TABLE "EntryTimeEntry";
ALTER TABLE "new_EntryTimeEntry" RENAME TO "EntryTimeEntry";
CREATE INDEX "EntryTimeEntry_reportId_order_idx" ON "EntryTimeEntry"("reportId", "order");
CREATE INDEX "EntryTimeEntry_phaseId_idx" ON "EntryTimeEntry"("phaseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WvMainOperation_order_idx" ON "WvMainOperation"("order");

-- CreateIndex
CREATE UNIQUE INDEX "WvOperationDetail_num_key" ON "WvOperationDetail"("num");

-- CreateIndex
CREATE INDEX "WvMatrixCell_detailNum_idx" ON "WvMatrixCell"("detailNum");

-- CreateIndex
CREATE INDEX "WvWorkingPhase_order_idx" ON "WvWorkingPhase"("order");

-- CreateIndex
CREATE INDEX "Job_wellId_order_idx" ON "Job"("wellId", "order");

-- CreateIndex
CREATE INDEX "JobPhase_jobId_order_idx" ON "JobPhase"("jobId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "JobPhasePlan_jobPhaseId_key" ON "JobPhasePlan"("jobPhaseId");

-- CreateIndex
CREATE INDEX "Afe_jobId_order_idx" ON "Afe"("jobId", "order");

-- CreateIndex
CREATE INDEX "AfeSupplement_afeId_order_idx" ON "AfeSupplement"("afeId", "order");

-- CreateIndex
CREATE INDEX "AfeLine_afeId_order_idx" ON "AfeLine"("afeId", "order");

-- CreateIndex
CREATE INDEX "AfeLine_costCodeId_idx" ON "AfeLine"("costCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCode_code1_code2_key" ON "CostCode"("code1", "code2");

-- CreateIndex
CREATE INDEX "CostItem_jobId_order_idx" ON "CostItem"("jobId", "order");

-- CreateIndex
CREATE INDEX "CostItem_phaseId_idx" ON "CostItem"("phaseId");

-- CreateIndex
CREATE INDEX "CostItem_costCodeId_idx" ON "CostItem"("costCodeId");

-- CreateIndex
CREATE INDEX "CostItem_jobId_costDate_idx" ON "CostItem"("jobId", "costDate");
