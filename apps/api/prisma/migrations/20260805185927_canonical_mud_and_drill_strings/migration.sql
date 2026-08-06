/*
  Warnings:

  - You are about to drop the `EntryBhaItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `calcium` on the `EntryMud` table. All the data in the column will be lost.
  - You are about to drop the column `densityPpg` on the `EntryMud` table. All the data in the column will be lost.
  - You are about to drop the column `maxWeight` on the `EntryMud` table. All the data in the column will be lost.
  - You are about to drop the column `minWeight` on the `EntryMud` table. All the data in the column will be lost.
  - You are about to drop the column `tempF` on the `EntryMud` table. All the data in the column will be lost.
  - You are about to drop the column `waterLoss` on the `EntryMud` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "EntryBhaItem_reportId_order_idx";

-- AlterTable
ALTER TABLE "EntryBitRun" ADD COLUMN "bitRevs" REAL;
ALTER TABLE "EntryBitRun" ADD COLUMN "make" TEXT;
ALTER TABLE "EntryBitRun" ADD COLUMN "model" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "EntryBhaItem";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "EntryDrillString" (
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
    "note" TEXT,
    CONSTRAINT "EntryDrillString_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryDrillStringComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drillStringId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "itemDes" TEXT,
    "serv" TEXT,
    "sn" TEXT,
    "odIn" REAL,
    "idIn" REAL,
    "jts" INTEGER,
    "lenM" REAL,
    "cumLenM" REAL,
    "com" TEXT,
    CONSTRAINT "EntryDrillStringComponent_drillStringId_fkey" FOREIGN KEY ("drillStringId") REFERENCES "EntryDrillString" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EntryMud" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "mudSystem" TEXT,
    "densityMinPpg" REAL,
    "densityMaxPpg" REAL,
    "reportTime" TEXT,
    "funnelVisc" REAL,
    "depthMkb" REAL,
    "tFlowlineC" REAL,
    "filtrateMl" REAL,
    "vis3rpm" REAL,
    "vis6rpm" REAL,
    "percentWater" REAL,
    "lowGravitySolidsPct" REAL,
    "hardnessCaPpm" REAL,
    "mudLostBbl" REAL,
    "activeMudVolBbl" REAL,
    "volMudResBbl" REAL,
    "pv" REAL,
    "yp" REAL,
    "gelInitial" REAL,
    "gel10min" REAL,
    "fan600" REAL,
    "fan300" REAL,
    "ph" REAL,
    "alkalinity" REAL,
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
    "solidsPct" REAL,
    CONSTRAINT "EntryMud_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EntryMud" ("activeMudVolBbl", "airFoam", "alkalinity", "chloride", "depthMkb", "eStability", "fan300", "fan600", "filtrateMl", "funnelVisc", "gel10min", "gelInitial", "hardnessCaPpm", "hpht", "id", "kcl", "lowGravitySolidsPct", "mbt", "mf", "mudLostBbl", "mudSystem", "oilPct", "oilWaterRatio", "percentWater", "pf", "ph", "pv", "reportId", "reportTime", "solidsPct", "tFlowlineC", "vis3rpm", "vis6rpm", "volMudResBbl", "yp") SELECT "activeMudVolBbl", "airFoam", "alkalinity", "chloride", "depthMkb", "eStability", "fan300", "fan600", "filtrateMl", "funnelVisc", "gel10min", "gelInitial", "hardnessCaPpm", "hpht", "id", "kcl", "lowGravitySolidsPct", "mbt", "mf", "mudLostBbl", "mudSystem", "oilPct", "oilWaterRatio", "percentWater", "pf", "ph", "pv", "reportId", "reportTime", "solidsPct", "tFlowlineC", "vis3rpm", "vis6rpm", "volMudResBbl", "yp" FROM "EntryMud";
DROP TABLE "EntryMud";
ALTER TABLE "new_EntryMud" RENAME TO "EntryMud";
CREATE UNIQUE INDEX "EntryMud_reportId_key" ON "EntryMud"("reportId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EntryDrillString_reportId_order_idx" ON "EntryDrillString"("reportId", "order");

-- CreateIndex
CREATE INDEX "EntryDrillStringComponent_drillStringId_order_idx" ON "EntryDrillStringComponent"("drillStringId", "order");
