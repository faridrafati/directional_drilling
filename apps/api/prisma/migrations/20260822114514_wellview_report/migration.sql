-- CreateTable
CREATE TABLE "WellviewReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "database" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "definition" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WellviewReport_database_name_key" ON "WellviewReport"("database", "name");
