-- AlterTable
ALTER TABLE "EntryBitRun" ADD COLUMN "lengthM" REAL;

-- AlterTable
ALTER TABLE "EntryDrillString" ADD COLUMN "stringWtKlbf" REAL;

-- AlterTable
ALTER TABLE "EntryDrillStringComponent" ADD COLUMN "topThread" TEXT;

-- AlterTable
ALTER TABLE "EntryOnboardCompany" ADD COLUMN "personnelType" TEXT;
ALTER TABLE "EntryOnboardCompany" ADD COLUMN "totWorkTimeHr" REAL;

-- AlterTable
ALTER TABLE "EntrySupervisor" ADD COLUMN "mobile" TEXT;

-- CreateTable
CREATE TABLE "EntryWellbore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "kind" TEXT,
    "koMdMkb" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryWellbore_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryMudPump" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rigId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pumpNo" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "ratingHp" REAL,
    "rodDiaIn" REAL,
    "strokeIn" REAL,
    "linerSizeIn" TEXT,
    "volPerStkBbl" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryMudPump_rigId_fkey" FOREIGN KEY ("rigId") REFERENCES "EntryRig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryMudVolume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT,
    "toWellBbl" REAL,
    "fromWellBbl" REAL,
    CONSTRAINT "EntryMudVolume_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntrySafetyCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "time" TEXT,
    "type" TEXT,
    "des" TEXT,
    CONSTRAINT "EntrySafetyCheck_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntrySafetyIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "time" TEXT,
    "category" TEXT,
    "type" TEXT,
    "subType" TEXT,
    "cause" TEXT,
    "lostTime" BOOLEAN,
    "severity" TEXT,
    CONSTRAINT "EntrySafetyIncident_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryIntervalProblem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "problemType" TEXT,
    "problemSubType" TEXT,
    "startDate" TEXT,
    "startTime" TEXT,
    "startDepthMkb" REAL,
    "endDepthMkb" REAL,
    "accountableParty" TEXT,
    "estCost" REAL,
    "estLostTimeHr" REAL,
    "comment" TEXT,
    CONSTRAINT "EntryIntervalProblem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryIntervalLesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lessonType" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "startDepthMkb" REAL,
    "endDepthMkb" REAL,
    "estCostSaving" REAL,
    "estTimeSavingHr" REAL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryIntervalLesson_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryKick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "kickDate" TEXT,
    "kickTime" TEXT,
    "kickDepthMkb" REAL,
    "controlDate" TEXT,
    "controlTime" TEXT,
    "controlDepthMkb" REAL,
    "kickClass" TEXT,
    "killNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryKick_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryLostCirculation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startDate" TEXT,
    "topDepthMkb" REAL,
    "bottomDepthMkb" REAL,
    "opsInProg" TEXT,
    "volLostTotBbl" REAL,
    "endDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryLostCirculation_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EntryDrillingParameter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startMkb" REAL,
    "endDepthMkb" REAL,
    "drillTimeHr" REAL,
    "slideTimeHr" REAL,
    "circTimeHr" REAL,
    "intRopMHr" REAL,
    "drillTq" REAL,
    "rpm" REAL,
    "qFlowGpm" REAL,
    "sppPsi" REAL,
    "wob1000Lbf" REAL,
    "wellboreId" TEXT,
    "drillStrWtKlbf" REAL,
    "puStrWtKlbf" REAL,
    "soStrWtKlbf" REAL,
    "offBottomTorque" REAL,
    "qGasInjM3Min" REAL,
    "tInjC" REAL,
    "pBhAnnPsi" REAL,
    "tBhC" REAL,
    "pSurfAnnulusPsi" REAL,
    "tSurfAnnulusC" REAL,
    "qLiqReturnGpm" REAL,
    "qGasReturnM3Min" REAL,
    CONSTRAINT "EntryDrillingParameter_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryDrillingParameter_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EntryDrillingParameter" ("circTimeHr", "drillTimeHr", "drillTq", "endDepthMkb", "id", "intRopMHr", "order", "qFlowGpm", "reportId", "rpm", "slideTimeHr", "sppPsi", "startMkb", "wob1000Lbf") SELECT "circTimeHr", "drillTimeHr", "drillTq", "endDepthMkb", "id", "intRopMHr", "order", "qFlowGpm", "reportId", "rpm", "slideTimeHr", "sppPsi", "startMkb", "wob1000Lbf" FROM "EntryDrillingParameter";
DROP TABLE "EntryDrillingParameter";
ALTER TABLE "new_EntryDrillingParameter" RENAME TO "EntryDrillingParameter";
CREATE INDEX "EntryDrillingParameter_reportId_order_idx" ON "EntryDrillingParameter"("reportId", "order");
CREATE INDEX "EntryDrillingParameter_wellboreId_idx" ON "EntryDrillingParameter"("wellboreId");
CREATE TABLE "new_EntryScrRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pumpNo" TEXT,
    "depthMkb" REAL,
    "strokesSpm" REAL,
    "effPct" REAL,
    "pPsi" REAL,
    "qFlowGpm" REAL,
    "mudPumpId" TEXT,
    CONSTRAINT "EntryScrRate_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryScrRate_mudPumpId_fkey" FOREIGN KEY ("mudPumpId") REFERENCES "EntryMudPump" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EntryScrRate" ("depthMkb", "effPct", "id", "order", "pPsi", "pumpNo", "qFlowGpm", "reportId", "strokesSpm") SELECT "depthMkb", "effPct", "id", "order", "pPsi", "pumpNo", "qFlowGpm", "reportId", "strokesSpm" FROM "EntryScrRate";
DROP TABLE "EntryScrRate";
ALTER TABLE "new_EntryScrRate" RENAME TO "EntryScrRate";
CREATE INDEX "EntryScrRate_reportId_order_idx" ON "EntryScrRate"("reportId", "order");
CREATE INDEX "EntryScrRate_mudPumpId_idx" ON "EntryScrRate"("mudPumpId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EntryWellbore_wellId_order_idx" ON "EntryWellbore"("wellId", "order");

-- CreateIndex
CREATE INDEX "EntryMudPump_rigId_order_idx" ON "EntryMudPump"("rigId", "order");

-- CreateIndex
CREATE INDEX "EntryMudVolume_reportId_order_idx" ON "EntryMudVolume"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntrySafetyCheck_reportId_order_idx" ON "EntrySafetyCheck"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntrySafetyIncident_reportId_order_idx" ON "EntrySafetyIncident"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryIntervalProblem_reportId_order_idx" ON "EntryIntervalProblem"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryIntervalLesson_wellId_order_idx" ON "EntryIntervalLesson"("wellId", "order");

-- CreateIndex
CREATE INDEX "EntryKick_wellId_order_idx" ON "EntryKick"("wellId", "order");

-- CreateIndex
CREATE INDEX "EntryLostCirculation_wellId_order_idx" ON "EntryLostCirculation"("wellId", "order");
