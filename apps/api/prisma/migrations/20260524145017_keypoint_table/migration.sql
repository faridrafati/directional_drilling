-- CreateTable
CREATE TABLE "Keypoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calculationId" TEXT NOT NULL,
    "segmentOrder" INTEGER NOT NULL,
    "roleIndex" INTEGER NOT NULL,
    "comment" TEXT,
    "md" REAL NOT NULL,
    "inc" REAL NOT NULL,
    "azm" REAL NOT NULL,
    "tvd" REAL NOT NULL,
    "vsec" REAL NOT NULL,
    "ns" REAL NOT NULL,
    "ew" REAL NOT NULL,
    "dls" REAL NOT NULL,
    "tf" REAL NOT NULL,
    "br" REAL NOT NULL,
    "tr" REAL NOT NULL,
    "dmd" REAL NOT NULL,
    CONSTRAINT "Keypoint_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Keypoint_calculationId_segmentOrder_roleIndex_idx" ON "Keypoint"("calculationId", "segmentOrder", "roleIndex");
