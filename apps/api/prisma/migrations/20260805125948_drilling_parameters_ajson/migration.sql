-- AlterTable
ALTER TABLE "EntryMud" ADD COLUMN "activeMudVolBbl" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "densityPpg" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "depthMkb" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "filtrateMl" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "hardnessCaPpm" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "lowGravitySolidsPct" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "mudLostBbl" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "percentWater" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "tFlowlineC" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "vis3rpm" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "vis6rpm" REAL;
ALTER TABLE "EntryMud" ADD COLUMN "volMudResBbl" REAL;

-- AlterTable
ALTER TABLE "EntrySurvey" ADD COLUMN "build" REAL;
ALTER TABLE "EntrySurvey" ADD COLUMN "vs" REAL;

-- CreateTable
CREATE TABLE "EntryDrillingParameter" (
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
    CONSTRAINT "EntryDrillingParameter_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EntryReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EntryDrillingParameter_reportId_order_idx" ON "EntryDrillingParameter"("reportId", "order");
