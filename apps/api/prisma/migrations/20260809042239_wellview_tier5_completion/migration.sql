-- AlterTable
ALTER TABLE "EntryWell" ADD COLUMN "directionsToWell" TEXT;
ALTER TABLE "EntryWell" ADD COLUMN "kbTubingHeadDistance" REAL;
ALTER TABLE "EntryWell" ADD COLUMN "otherElevation" REAL;
ALTER TABLE "EntryWell" ADD COLUMN "thElevation" REAL;

-- CreateTable
CREATE TABLE "Reservoir" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "topMkb" REAL,
    "btmMkb" REAL,
    "datumDepthM" REAL,
    "fluidType" TEXT,
    CONSTRAINT "Reservoir_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WellZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "topMkb" REAL,
    "btmMkb" REAL,
    "status" TEXT,
    CONSTRAINT "WellZone_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WellZone_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Perforation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "zoneId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT,
    "time" TEXT,
    "topMkb" REAL,
    "btmMkb" REAL,
    "company" TEXT,
    "conveyanceMethod" TEXT,
    "gunSizeIn" TEXT,
    "carrierMake" TEXT,
    "shotDensityPerM" REAL,
    "chargeType" TEXT,
    "phasingDeg" REAL,
    "orientation" TEXT,
    "orientationMethod" TEXT,
    "overUnderBalanced" TEXT,
    "pOverUnderPsi" REAL,
    "flMdBeforeMkb" REAL,
    "flMdAfterMkb" REAL,
    "pSurfInitPsi" REAL,
    "pFinalSurfPsi" REAL,
    "referenceLog" TEXT,
    CONSTRAINT "Perforation_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Perforation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WellZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerforationStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "perforationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT,
    "status" TEXT,
    "com" TEXT,
    CONSTRAINT "PerforationStatus_perforationId_fkey" FOREIGN KEY ("perforationId") REFERENCES "Perforation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TubingString" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "runDate" TEXT,
    "stringLengthM" REAL,
    "setDepthMkb" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TubingString_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TubingString_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TubingComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tubingStringId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "itemDes" TEXT,
    "jts" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "odIn" TEXT,
    "idIn" REAL,
    "massPerLenKgM" REAL,
    "grade" TEXT,
    "lenM" REAL,
    "topMkb" REAL,
    "btmMkb" REAL,
    "serialNo" TEXT,
    CONSTRAINT "TubingComponent_tubingStringId_fkey" FOREIGN KEY ("tubingStringId") REFERENCES "TubingString" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlugBack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT,
    "depthMkb" REAL,
    "method" TEXT,
    "com" TEXT,
    CONSTRAINT "PlugBack_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviationSurveyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT,
    "des" TEXT,
    "proposed" BOOLEAN,
    "definitive" BOOLEAN,
    "company" TEXT,
    CONSTRAINT "DeviationSurveyRecord_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "zoneId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startDate" TEXT,
    "endDate" TEXT,
    "activityType" TEXT,
    "prodTimeDays" REAL,
    "downTimeDays" REAL,
    "volOilBbl" REAL,
    "volWaterBbl" REAL,
    "volResGasMcf" REAL,
    "qOilBblD" REAL,
    "qWaterBblD" REAL,
    "qResGasMcfD" REAL,
    "waterGasRatioPct" REAL,
    "com" TEXT,
    CONSTRAINT "ProductionPeriod_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionPeriod_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WellZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentFailure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT,
    "failureType" TEXT,
    "componentDes" TEXT,
    "cost" REAL,
    "accountableParty" TEXT,
    "com" TEXT,
    CONSTRAINT "EquipmentFailure_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Stimulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "zoneId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT,
    "time" TEXT,
    "type" TEXT,
    "deliveryMode" TEXT,
    "company" TEXT,
    "volumeM3" REAL,
    "com" TEXT,
    CONSTRAINT "Stimulation_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Stimulation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WellZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Reservoir_wellId_order_idx" ON "Reservoir"("wellId", "order");

-- CreateIndex
CREATE INDEX "WellZone_wellId_order_idx" ON "WellZone"("wellId", "order");

-- CreateIndex
CREATE INDEX "Perforation_wellId_order_idx" ON "Perforation"("wellId", "order");

-- CreateIndex
CREATE INDEX "PerforationStatus_perforationId_order_idx" ON "PerforationStatus"("perforationId", "order");

-- CreateIndex
CREATE INDEX "TubingString_wellId_order_idx" ON "TubingString"("wellId", "order");

-- CreateIndex
CREATE INDEX "TubingComponent_tubingStringId_order_idx" ON "TubingComponent"("tubingStringId", "order");

-- CreateIndex
CREATE INDEX "PlugBack_wellId_order_idx" ON "PlugBack"("wellId", "order");

-- CreateIndex
CREATE INDEX "DeviationSurveyRecord_wellId_order_idx" ON "DeviationSurveyRecord"("wellId", "order");

-- CreateIndex
CREATE INDEX "ProductionPeriod_wellId_order_idx" ON "ProductionPeriod"("wellId", "order");

-- CreateIndex
CREATE INDEX "EquipmentFailure_wellId_order_idx" ON "EquipmentFailure"("wellId", "order");

-- CreateIndex
CREATE INDEX "Stimulation_wellId_order_idx" ON "Stimulation"("wellId", "order");
