-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "units" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    CONSTRAINT "Country_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Field" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ns" REAL,
    "ew" REAL,
    "msl" REAL,
    CONSTRAINT "Field_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Well" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ns" REAL,
    "ew" REAL,
    "msl" REAL,
    "wellType" TEXT,
    "tvd" REAL,
    "md" REAL,
    "comment" TEXT,
    CONSTRAINT "Well_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Calculation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wellId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    CONSTRAINT "Calculation_wellId_fkey" FOREIGN KEY ("wellId") REFERENCES "Well" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calculationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "profileType" INTEGER NOT NULL,
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
    "surveyTools" TEXT,
    CONSTRAINT "Segment_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calculationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
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

-- CreateTable
CREATE TABLE "GridFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "xmin" REAL NOT NULL,
    "xmax" REAL NOT NULL,
    "ymin" REAL NOT NULL,
    "ymax" REAL NOT NULL,
    "xinc" REAL NOT NULL,
    "yinc" REAL NOT NULL,
    "ncol" INTEGER NOT NULL,
    "nrow" INTEGER NOT NULL,
    "units" TEXT NOT NULL,
    "errorVal" REAL NOT NULL,
    "data" BLOB NOT NULL,
    CONSTRAINT "GridFile_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Country_projectId_idx" ON "Country"("projectId");

-- CreateIndex
CREATE INDEX "Field_countryId_idx" ON "Field"("countryId");

-- CreateIndex
CREATE INDEX "Well_fieldId_idx" ON "Well"("fieldId");

-- CreateIndex
CREATE INDEX "Calculation_wellId_idx" ON "Calculation"("wellId");

-- CreateIndex
CREATE INDEX "Segment_calculationId_order_idx" ON "Segment"("calculationId", "order");

-- CreateIndex
CREATE INDEX "Station_calculationId_order_idx" ON "Station"("calculationId", "order");

-- CreateIndex
CREATE INDEX "GridFile_fieldId_idx" ON "GridFile"("fieldId");
