-- AlterTable
ALTER TABLE "EntryDrillStringComponent" ADD COLUMN "connections" TEXT;
ALTER TABLE "EntryDrillStringComponent" ADD COLUMN "driftIn" REAL;
ALTER TABLE "EntryDrillStringComponent" ADD COLUMN "gaugeIn" REAL;
ALTER TABLE "EntryDrillStringComponent" ADD COLUMN "grade" TEXT;
ALTER TABLE "EntryDrillStringComponent" ADD COLUMN "massPerLenKgM" REAL;

-- CreateTable
CREATE TABLE "EntryBhaRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "wellboreId" TEXT,
    "bhaNo" INTEGER,
    "depthOutMkb" REAL,
    "dateOut" TEXT,
    "timeOut" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EntryBhaRun_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "EntryWell" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryBhaRun_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryBhaSensor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bhaRunId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sensorType" TEXT,
    "distFromBitM" REAL,
    "note" TEXT,
    CONSTRAINT "EntryBhaSensor_bhaRunId_fkey" FOREIGN KEY ("bhaRunId") REFERENCES "EntryBhaRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EntryBitRun" (
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
    "make" TEXT,
    "model" TEXT,
    "bitRevs" REAL,
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
    "lengthM" REAL,
    "itemCost" REAL,
    "bhaRunId" TEXT,
    "cmtDrilled" TEXT,
    "washAndRun" TEXT,
    "bitChangeIn" TEXT,
    "bitChangeOut" TEXT,
    CONSTRAINT "EntryBitRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryBitRun_bhaRunId_fkey" FOREIGN KEY ("bhaRunId") REFERENCES "EntryBhaRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EntryBitRun" ("annularVelocity", "bitChangeIn", "bitChangeOut", "bitNo", "bitRevs", "bitSerialNo", "cmtDrilled", "dullGrade", "hours", "hsi", "iadcCode", "id", "lengthM", "make", "meterage", "model", "nozzles", "order", "pumpOutput", "pumpPressure", "pumpType", "reasonPulled", "reportId", "rpm", "size", "tfa", "torque", "type", "washAndRun", "wob") SELECT "annularVelocity", "bitChangeIn", "bitChangeOut", "bitNo", "bitRevs", "bitSerialNo", "cmtDrilled", "dullGrade", "hours", "hsi", "iadcCode", "id", "lengthM", "make", "meterage", "model", "nozzles", "order", "pumpOutput", "pumpPressure", "pumpType", "reasonPulled", "reportId", "rpm", "size", "tfa", "torque", "type", "washAndRun", "wob" FROM "EntryBitRun";
DROP TABLE "EntryBitRun";
ALTER TABLE "new_EntryBitRun" RENAME TO "EntryBitRun";
CREATE INDEX "EntryBitRun_reportId_order_idx" ON "EntryBitRun"("reportId", "order");
CREATE TABLE "new_EntryDrillString" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "bhaNo" INTEGER,
    "depthInMkb" REAL,
    "dateIn" TEXT,
    "objective" TEXT,
    "depthDrilledM" REAL,
    "drillingTimeHr" REAL,
    "circulatingTimeHr" REAL,
    "rotatingTimeHr" REAL,
    "slidingTimeHr" REAL,
    "stringWtKlbf" REAL,
    "note" TEXT,
    "bhaRunId" TEXT,
    CONSTRAINT "EntryDrillString_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryDrillString_bhaRunId_fkey" FOREIGN KEY ("bhaRunId") REFERENCES "EntryBhaRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EntryDrillString" ("bhaNo", "circulatingTimeHr", "dateIn", "depthDrilledM", "depthInMkb", "drillingTimeHr", "id", "name", "note", "objective", "order", "reportId", "rotatingTimeHr", "slidingTimeHr", "stringWtKlbf") SELECT "bhaNo", "circulatingTimeHr", "dateIn", "depthDrilledM", "depthInMkb", "drillingTimeHr", "id", "name", "note", "objective", "order", "reportId", "rotatingTimeHr", "slidingTimeHr", "stringWtKlbf" FROM "EntryDrillString";
DROP TABLE "EntryDrillString";
ALTER TABLE "new_EntryDrillString" RENAME TO "EntryDrillString";
CREATE INDEX "EntryDrillString_reportId_order_idx" ON "EntryDrillString"("reportId", "order");
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
    "bhaRunId" TEXT,
    CONSTRAINT "EntryDrillingParameter_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryDrillingParameter_wellboreId_fkey" FOREIGN KEY ("wellboreId") REFERENCES "EntryWellbore" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EntryDrillingParameter_bhaRunId_fkey" FOREIGN KEY ("bhaRunId") REFERENCES "EntryBhaRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EntryDrillingParameter" ("circTimeHr", "drillStrWtKlbf", "drillTimeHr", "drillTq", "endDepthMkb", "id", "intRopMHr", "offBottomTorque", "order", "pBhAnnPsi", "pSurfAnnulusPsi", "puStrWtKlbf", "qFlowGpm", "qGasInjM3Min", "qGasReturnM3Min", "qLiqReturnGpm", "reportId", "rpm", "slideTimeHr", "soStrWtKlbf", "sppPsi", "startMkb", "tBhC", "tInjC", "tSurfAnnulusC", "wellboreId", "wob1000Lbf") SELECT "circTimeHr", "drillStrWtKlbf", "drillTimeHr", "drillTq", "endDepthMkb", "id", "intRopMHr", "offBottomTorque", "order", "pBhAnnPsi", "pSurfAnnulusPsi", "puStrWtKlbf", "qFlowGpm", "qGasInjM3Min", "qGasReturnM3Min", "qLiqReturnGpm", "reportId", "rpm", "slideTimeHr", "soStrWtKlbf", "sppPsi", "startMkb", "tBhC", "tInjC", "tSurfAnnulusC", "wellboreId", "wob1000Lbf" FROM "EntryDrillingParameter";
DROP TABLE "EntryDrillingParameter";
ALTER TABLE "new_EntryDrillingParameter" RENAME TO "EntryDrillingParameter";
CREATE INDEX "EntryDrillingParameter_reportId_order_idx" ON "EntryDrillingParameter"("reportId", "order");
CREATE INDEX "EntryDrillingParameter_wellboreId_idx" ON "EntryDrillingParameter"("wellboreId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EntryBhaRun_wellId_idx" ON "EntryBhaRun"("wellId");

-- CreateIndex
CREATE INDEX "EntryBhaRun_wellboreId_idx" ON "EntryBhaRun"("wellboreId");

-- CreateIndex
CREATE UNIQUE INDEX "EntryBhaRun_wellId_bhaNo_key" ON "EntryBhaRun"("wellId", "bhaNo");

-- CreateIndex
CREATE INDEX "EntryBhaSensor_bhaRunId_order_idx" ON "EntryBhaSensor"("bhaRunId", "order");

-- ── backfill: one BHA run per (well, bhaNo) already recorded on the daily rows
--
-- Reports 02 and 03 are scoped to a RUN, but every assembly entered before this
-- migration lives only as per-day slices. This lifts them: a run is created for
-- each distinct (well, bhaNo) pair, and the day rows that named that number are
-- pointed at it.
--
-- Rows with no bhaNo stay unlinked on purpose — there is nothing to match them
-- on, and guessing would silently merge two assemblies into one run.
INSERT INTO "EntryBhaRun" ("id", "wellId", "bhaNo", "createdAt", "updatedAt")
SELECT
    'bha_' || r."wellId" || '_' || ds."bhaNo",
    r."wellId",
    ds."bhaNo",
    CAST(strftime('%s','now') AS INTEGER) * 1000,
    CAST(strftime('%s','now') AS INTEGER) * 1000
FROM "EntryDrillString" ds
JOIN "EntryReport" r ON r."id" = ds."reportId"
WHERE ds."bhaNo" IS NOT NULL
GROUP BY r."wellId", ds."bhaNo";

UPDATE "EntryDrillString"
SET "bhaRunId" = 'bha_' || (SELECT r."wellId" FROM "EntryReport" r WHERE r."id" = "EntryDrillString"."reportId") || '_' || "bhaNo"
WHERE "bhaNo" IS NOT NULL;

-- A bit row belongs to the day's string. When the day ran exactly one string the
-- answer is unambiguous; when it ran two, the sheet is filled top to bottom so
-- the ordinals line up, which is the only key the data actually has.
UPDATE "EntryBitRun"
SET "bhaRunId" = (
    SELECT ds."bhaRunId" FROM "EntryDrillString" ds
    WHERE ds."reportId" = "EntryBitRun"."reportId" AND ds."order" = "EntryBitRun"."order"
)
WHERE EXISTS (
    SELECT 1 FROM "EntryDrillString" ds
    WHERE ds."reportId" = "EntryBitRun"."reportId" AND ds."order" = "EntryBitRun"."order"
      AND ds."bhaRunId" IS NOT NULL
);

-- A drilled interval belongs to the run in the hole that day. Only assigned when
-- the day ran a single string; with two, depth would have to arbitrate and the
-- daily rows do not record enough to do that safely.
UPDATE "EntryDrillingParameter"
SET "bhaRunId" = (
    SELECT ds."bhaRunId" FROM "EntryDrillString" ds
    WHERE ds."reportId" = "EntryDrillingParameter"."reportId"
)
WHERE (SELECT COUNT(*) FROM "EntryDrillString" ds WHERE ds."reportId" = "EntryDrillingParameter"."reportId") = 1;
