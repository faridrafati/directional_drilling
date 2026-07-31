-- CreateTable
CREATE TABLE "EntryUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'companyman',
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EntryRig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contractor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EntryWell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rigId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "field" TEXT,
    "legacyWellCode" TEXT,
    "location" TEXT,
    "wellType" TEXT,
    "profile" TEXT,
    "reservoir" TEXT,
    "contractor" TEXT,
    "spudDate" TEXT,
    "rigReleasedDate" TEXT,
    "rtElevation" REAL,
    "waterDepth" REAL,
    "finalForecastDepth" REAL,
    "forecastDays" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EntryWell_rigId_fkey" FOREIGN KEY ("rigId") REFERENCES "EntryRig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wellId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "EntryUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryAssignment_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "reportDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "morningDepth" REAL,
    "midnightDepth" REAL,
    "previousDepth" REAL,
    "drillingTime" REAL,
    "cumDrillingTime" REAL,
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
    "windSpeedDir" TEXT,
    "waveVisible" TEXT,
    "freshWater" REAL,
    "fuel" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    CONSTRAINT "EntryReport_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "EntryUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryBitRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "bitNo" TEXT,
    "bitSerialNo" TEXT,
    "size" TEXT,
    "type" TEXT,
    "iadcCode" TEXT,
    "nozzles" TEXT,
    "tfa" REAL,
    "meterage" REAL,
    "hours" REAL,
    "wob" REAL,
    "rpm" REAL,
    "torque" TEXT,
    "dullGrade" TEXT,
    "reasonPulled" TEXT,
    "pumpType" TEXT,
    "pumpOutput" REAL,
    "pumpPressure" REAL,
    "annularVelocity" REAL,
    "hsi" REAL,
    "cmtDrilled" TEXT,
    "washAndRun" TEXT,
    "bitChangeIn" TEXT,
    "bitChangeOut" TEXT,
    CONSTRAINT "EntryBitRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryBhaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "assemblyNo" TEXT,
    "lengthM" REAL,
    "specification" TEXT,
    CONSTRAINT "EntryBhaItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryDrillPipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "size" TEXT,
    "grade" TEXT,
    "lengthM" REAL,
    CONSTRAINT "EntryDrillPipe_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryTool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT,
    "size" TEXT,
    "serialNo" TEXT,
    "hours" REAL,
    CONSTRAINT "EntryTool_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryMud" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "mudSystem" TEXT,
    "maxWeight" REAL,
    "minWeight" REAL,
    "reportTime" TEXT,
    "funnelVisc" REAL,
    "pv" REAL,
    "yp" REAL,
    "gelInitial" REAL,
    "gel10min" REAL,
    "fan600" REAL,
    "fan300" REAL,
    "ph" REAL,
    "alkalinity" REAL,
    "waterLoss" REAL,
    "hpht" REAL,
    "airFoam" REAL,
    "oilPct" REAL,
    "oilWaterRatio" TEXT,
    "eStability" REAL,
    "kcl" REAL,
    "mbt" REAL,
    "pf" REAL,
    "mf" REAL,
    "chloride" REAL,
    "calcium" REAL,
    "solidsPct" REAL,
    "tempF" REAL,
    CONSTRAINT "EntryMud_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntrySolidControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "hours" REAL,
    "underFlow" REAL,
    "overFlow" REAL,
    "feed" REAL,
    "cons" REAL,
    "fprs" REAL,
    CONSTRAINT "EntrySolidControl_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryChemical" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "material" TEXT,
    "unit" TEXT,
    "used" REAL,
    "received" REAL,
    "stock" REAL,
    "outstanding" REAL,
    "requested" REAL,
    "sent" REAL,
    CONSTRAINT "EntryChemical_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryCasingRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "casing" TEXT,
    "depth" REAL,
    "joints" REAL,
    CONSTRAINT "EntryCasingRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryFormationTop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "formation" TEXT,
    "depth" REAL,
    "secondDepth" REAL,
    "type" TEXT,
    CONSTRAINT "EntryFormationTop_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntrySurvey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "md" REAL,
    "inc" REAL,
    "azi" REAL,
    "tvd" REAL,
    "ns" REAL,
    "ew" REAL,
    "dls" REAL,
    CONSTRAINT "EntrySurvey_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryTimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "group" TEXT,
    "type" TEXT,
    "activity" TEXT,
    "hours" REAL,
    CONSTRAINT "EntryTimeEntry_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "opCode" TEXT,
    "fromTime" TEXT,
    "toTime" TEXT,
    "remarks" TEXT,
    CONSTRAINT "EntryOperation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EntryUser_username_key" ON "EntryUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "EntryRig_name_key" ON "EntryRig"("name");

-- CreateIndex
CREATE INDEX "EntryWell_rigId_idx" ON "EntryWell"("rigId");

-- CreateIndex
CREATE UNIQUE INDEX "EntryWell_rigId_name_key" ON "EntryWell"("rigId", "name");

-- CreateIndex
CREATE INDEX "EntryAssignment_wellId_idx" ON "EntryAssignment"("wellId");

-- CreateIndex
CREATE UNIQUE INDEX "EntryAssignment_userId_wellId_key" ON "EntryAssignment"("userId", "wellId");

-- CreateIndex
CREATE INDEX "EntryReport_wellId_status_idx" ON "EntryReport"("wellId", "status");

-- CreateIndex
CREATE INDEX "EntryReport_userId_idx" ON "EntryReport"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EntryReport_wellId_reportDate_key" ON "EntryReport"("wellId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "EntryReport_wellId_serialNo_key" ON "EntryReport"("wellId", "serialNo");

-- CreateIndex
CREATE INDEX "EntryBitRun_reportId_order_idx" ON "EntryBitRun"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryBhaItem_reportId_order_idx" ON "EntryBhaItem"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryDrillPipe_reportId_order_idx" ON "EntryDrillPipe"("reportId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "EntryTool_reportId_kind_key" ON "EntryTool"("reportId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "EntryMud_reportId_key" ON "EntryMud"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "EntrySolidControl_reportId_unit_key" ON "EntrySolidControl"("reportId", "unit");

-- CreateIndex
CREATE INDEX "EntryChemical_reportId_order_idx" ON "EntryChemical"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryCasingRun_reportId_order_idx" ON "EntryCasingRun"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryFormationTop_reportId_order_idx" ON "EntryFormationTop"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntrySurvey_reportId_order_idx" ON "EntrySurvey"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryTimeEntry_reportId_order_idx" ON "EntryTimeEntry"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryOperation_reportId_order_idx" ON "EntryOperation"("reportId", "order");
