-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calculationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "segmentOrder" INTEGER NOT NULL DEFAULT 0,
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
    CONSTRAINT "Station_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Station" ("azm", "br", "calculationId", "comment", "dls", "dmd", "ew", "id", "inc", "md", "ns", "order", "tf", "tr", "tvd", "vsec") SELECT "azm", "br", "calculationId", "comment", "dls", "dmd", "ew", "id", "inc", "md", "ns", "order", "tf", "tr", "tvd", "vsec" FROM "Station";
DROP TABLE "Station";
ALTER TABLE "new_Station" RENAME TO "Station";
CREATE INDEX "Station_calculationId_order_idx" ON "Station"("calculationId", "order");
CREATE INDEX "Station_calculationId_segmentOrder_idx" ON "Station"("calculationId", "segmentOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
