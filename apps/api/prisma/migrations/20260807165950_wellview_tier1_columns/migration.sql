-- AlterTable
ALTER TABLE "EntryMud" ADD COLUMN "filterCake32nds" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "gel30min" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "mudLostSurfBbl" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "pm" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "potassiumMgL" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "sandPct" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "wholeMudAddedBbl" REAL;

-- AlterTable
ALTER TABLE "EntryReport" ADD COLUMN "daysRi" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "holeCondition" TEXT;
ALTER TABLE "EntryReport" ADD COLUMN "remarks" TEXT;
ALTER TABLE "EntryReport" ADD COLUMN "roadCondition" TEXT;
ALTER TABLE "EntryReport" ADD COLUMN "startDepthTvd" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "temperatureC" REAL;
ALTER TABLE "EntryReport" ADD COLUMN "weather" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EntryOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "opCode" TEXT,
    "opLetter" TEXT,
    "opDetail" TEXT,
    "timeIndicator" TEXT,
    "opCode2" TEXT,
    "isProblem" BOOLEAN NOT NULL DEFAULT false,
    "probHr" REAL,
    "problemRef" INTEGER,
    "fromTime" TEXT,
    "toTime" TEXT,
    "remarks" TEXT,
    CONSTRAINT "EntryOperation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EntryOperation" ("fromTime", "id", "opCode", "opDetail", "opLetter", "order", "remarks", "reportId", "timeIndicator", "toTime") SELECT "fromTime", "id", "opCode", "opDetail", "opLetter", "order", "remarks", "reportId", "timeIndicator", "toTime" FROM "EntryOperation";
DROP TABLE "EntryOperation";
ALTER TABLE "new_EntryOperation" RENAME TO "EntryOperation";
CREATE INDEX "EntryOperation_reportId_order_idx" ON "EntryOperation"("reportId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
