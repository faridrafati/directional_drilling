-- CreateTable
CREATE TABLE "WellviewQuery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "database" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "criteria" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "WellviewQuery_database_idx" ON "WellviewQuery"("database");

-- CreateIndex
CREATE UNIQUE INDEX "WellviewQuery_database_name_key" ON "WellviewQuery"("database", "name");
