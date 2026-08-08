-- CreateTable
CREATE TABLE "HoleSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sectionDes" TEXT,
    "sizeIn" TEXT,
    "actTopMkb" REAL,
    "actBtmMkb" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HoleSection_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HoleSection_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CasingString" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "runDate" TEXT,
    "setDepthMkb" REAL,
    "setTensionKn" REAL,
    "stringNominalOdIn" TEXT,
    "stringMinDriftIn" REAL,
    "centralizers" TEXT,
    "scratchers" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CasingString_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CasingString_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CasingComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "casingStringId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "jts" INTEGER,
    "itemDes" TEXT,
    "odIn" TEXT,
    "idIn" REAL,
    "massPerLenKgM" REAL,
    "grade" TEXT,
    "topThread" TEXT,
    "topMkb" REAL,
    "btmMkb" REAL,
    "lenM" REAL,
    "pBurstPsi" REAL,
    "pCollapsePsi" REAL,
    CONSTRAINT "CasingComponent_casingStringId_fkey" FOREIGN KEY ("casingStringId") REFERENCES "CasingString" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CementJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "casingStringId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "evaluationMethod" TEXT,
    "evaluationResults" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CementJob_casingStringId_fkey" FOREIGN KEY ("casingStringId") REFERENCES "CasingString" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CementJob_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CementStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cementJobId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "topDepthMkb" REAL,
    "bottomDepthMkb" REAL,
    "fullReturn" BOOLEAN,
    "volCementM3" REAL,
    "topPlug" BOOLEAN,
    "bottomPlug" BOOLEAN,
    "qPumpInitM3Min" REAL,
    "qPumpFinalM3Min" REAL,
    "avgPumpRateM3Min" REAL,
    "finalPumpPressurePsi" REAL,
    "plugBumpPressurePsi" REAL,
    "pipeReciprocated" BOOLEAN,
    "strokeM" REAL,
    "reciprocationRateSpm" REAL,
    "pipeRotated" BOOLEAN,
    "pipeRpm" REAL,
    "taggedDepthMkb" REAL,
    "tagMethod" TEXT,
    "depthPlugDrilledOutMkb" REAL,
    "drillOutDiameterIn" TEXT,
    "drillOutDate" TEXT,
    CONSTRAINT "CementStage_cementJobId_fkey" FOREIGN KEY ("cementJobId") REFERENCES "CementJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CementFluid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cementStageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "fluidType" TEXT,
    "fluidDescription" TEXT,
    "amountSacks" REAL,
    "cementClass" TEXT,
    "volumePumpedM3" REAL,
    "estimatedTopMkb" REAL,
    "estimatedBtmMkb" REAL,
    "yieldM3PerSack" REAL,
    "mixWaterLPerSack" REAL,
    "freeWaterPct" REAL,
    "densityPpg" REAL,
    "plasticViscosityCp" REAL,
    "thickeningTimeHr" REAL,
    "compressiveStrengthPsi" REAL,
    CONSTRAINT "CementFluid_cementStageId_fkey" FOREIGN KEY ("cementStageId") REFERENCES "CementStage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CementFluidAdditive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cementFluidId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "additive" TEXT,
    "additiveType" TEXT,
    "concentration" TEXT,
    CONSTRAINT "CementFluidAdditive_cementFluidId_fkey" FOREIGN KEY ("cementFluidId") REFERENCES "CementFluid" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EntryCasingRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "casing" TEXT,
    "depth" REAL,
    "joints" REAL,
    "runDate" TEXT,
    "topMkb" REAL,
    "com" TEXT,
    "casingStringId" TEXT,
    CONSTRAINT "EntryCasingRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryCasingRun_casingStringId_fkey" FOREIGN KEY ("casingStringId") REFERENCES "CasingString" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EntryCasingRun" ("casing", "com", "depth", "id", "joints", "order", "reportId", "runDate", "topMkb") SELECT "casing", "com", "depth", "id", "joints", "order", "reportId", "runDate", "topMkb" FROM "EntryCasingRun";
DROP TABLE "EntryCasingRun";
ALTER TABLE "new_EntryCasingRun" RENAME TO "EntryCasingRun";
CREATE INDEX "EntryCasingRun_reportId_order_idx" ON "EntryCasingRun"("reportId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "HoleSection_wellId_order_idx" ON "HoleSection"("wellId", "order");

-- CreateIndex
CREATE INDEX "CasingString_wellId_order_idx" ON "CasingString"("wellId", "order");

-- CreateIndex
CREATE INDEX "CasingComponent_casingStringId_order_idx" ON "CasingComponent"("casingStringId", "order");

-- CreateIndex
CREATE INDEX "CementJob_casingStringId_order_idx" ON "CementJob"("casingStringId", "order");

-- CreateIndex
CREATE INDEX "CementStage_cementJobId_order_idx" ON "CementStage"("cementJobId", "order");

-- CreateIndex
CREATE INDEX "CementFluid_cementStageId_order_idx" ON "CementFluid"("cementStageId", "order");

-- CreateIndex
CREATE INDEX "CementFluidAdditive_cementFluidId_order_idx" ON "CementFluidAdditive"("cementFluidId", "order");
