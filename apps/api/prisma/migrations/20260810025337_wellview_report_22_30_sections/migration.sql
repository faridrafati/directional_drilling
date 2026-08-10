-- AlterTable
ALTER TABLE "CementJob" ADD COLUMN "company" TEXT;

-- AlterTable
ALTER TABLE "CementStage" ADD COLUMN "volReturnM3" REAL;

-- AlterTable
ALTER TABLE "EntryLogRun" ADD COLUMN "cased" BOOLEAN;

-- AlterTable
ALTER TABLE "EquipmentFailure" ADD COLUMN "cause" TEXT;
ALTER TABLE "EquipmentFailure" ADD COLUMN "failedItem" TEXT;
ALTER TABLE "EquipmentFailure" ADD COLUMN "resolvedDate" TEXT;

-- AlterTable
ALTER TABLE "JobContact" ADD COLUMN "office" TEXT;

-- AlterTable
ALTER TABLE "WellFormation" ADD COLUMN "geologicAge" TEXT;

-- AlterTable
ALTER TABLE "WellZone" ADD COLUMN "statusDate" TEXT;

-- CreateTable
CREATE TABLE "OtherInHole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "des" TEXT,
    "odIn" TEXT,
    "idIn" REAL,
    "topMkb" REAL,
    "btmMkb" REAL,
    "make" TEXT,
    "model" TEXT,
    "runDate" TEXT,
    "pullDate" TEXT,
    "com" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OtherInHole_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OtherInHole_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BottomHoleCore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "coreNo" TEXT,
    "type" TEXT,
    "topMkb" REAL,
    "btmMkb" REAL,
    "recoveredM" REAL,
    "date" TEXT,
    "com" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BottomHoleCore_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BottomHoleCore_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RodString" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "runDate" TEXT,
    "setDepthMkb" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RodString_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RodString_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RodStringComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rodStringId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "itemDes" TEXT,
    "odNominalIn" TEXT,
    "massPerLenKgM" REAL,
    "grade" TEXT,
    "joints" INTEGER,
    "lenM" REAL,
    "topMkb" REAL,
    "btmMkb" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RodStringComponent_rodStringId_fkey" FOREIGN KEY ("rodStringId") REFERENCES "RodString" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RodPump" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "make" TEXT,
    "model" TEXT,
    "serialNo" TEXT,
    "pumpBoreIn" REAL,
    "apiPumpType" TEXT,
    "apiBarrelType" TEXT,
    "apiAnchorType" TEXT,
    "seatAssyType" TEXT,
    "barrelLenM" REAL,
    "nomPlungerLenM" REAL,
    "upperExtLenM" REAL,
    "lowerExtLenM" REAL,
    "plungerOdClearanceIn" REAL,
    "seatingAssemblyDes" TEXT,
    "seatAssySizeIn" REAL,
    "apiBarrelMaterial" TEXT,
    "apiPlungerMaterial" TEXT,
    "gasAnchorOdIn" REAL,
    "gasAnchorLenM" REAL,
    "travelingValveBallMaterial" TEXT,
    "travelingValveSeatMaterial" TEXT,
    "standingValveBallMaterial" TEXT,
    "standingValveSeatMaterial" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RodPump_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Swab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "zoneId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT,
    "swabCompany" TEXT,
    "totalVolBbl" REAL,
    "totalOilBbl" REAL,
    "totalBswBbl" REAL,
    "com" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Swab_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Swab_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WellZone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WellAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "des" TEXT,
    "kind" TEXT,
    "reference" TEXT,
    "date" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WellAttachment_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchematicAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "depthMkb" REAL,
    "annotation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchematicAnnotation_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchematicAnnotation_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WellNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT,
    "com" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WellNote_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StimulationStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stimulationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "stageNo" INTEGER,
    "stageType" TEXT,
    "topDepthMkb" REAL,
    "bottomDepthMkb" REAL,
    "cleanVolPumpedM3" REAL,
    "slurryVolM3" REAL,
    "proppantKg" REAL,
    "avgRateM3Min" REAL,
    "avgPressurePsi" REAL,
    "com" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StimulationStage_stimulationId_fkey" FOREIGN KEY ("stimulationId") REFERENCES "Stimulation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OtherInHole_wellId_order_idx" ON "OtherInHole"("wellId", "order");

-- CreateIndex
CREATE INDEX "BottomHoleCore_wellId_order_idx" ON "BottomHoleCore"("wellId", "order");

-- CreateIndex
CREATE INDEX "RodString_wellId_order_idx" ON "RodString"("wellId", "order");

-- CreateIndex
CREATE INDEX "RodStringComponent_rodStringId_order_idx" ON "RodStringComponent"("rodStringId", "order");

-- CreateIndex
CREATE INDEX "RodPump_wellId_order_idx" ON "RodPump"("wellId", "order");

-- CreateIndex
CREATE INDEX "Swab_wellId_order_idx" ON "Swab"("wellId", "order");

-- CreateIndex
CREATE INDEX "WellAttachment_wellId_order_idx" ON "WellAttachment"("wellId", "order");

-- CreateIndex
CREATE INDEX "SchematicAnnotation_wellId_order_idx" ON "SchematicAnnotation"("wellId", "order");

-- CreateIndex
CREATE INDEX "WellNote_wellId_order_idx" ON "WellNote"("wellId", "order");

-- CreateIndex
CREATE INDEX "StimulationStage_stimulationId_order_idx" ON "StimulationStage"("stimulationId", "order");
