/*
  Warnings:

  - You are about to drop the `brokers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `brokerId` on the `accounts` table. All the data in the column will be lost.
  - Added the required column `institutionId` to the `accounts` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "brokers_name_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "brokers";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contactNumber" TEXT,
    "websiteUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "accounts_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_accounts" ("accountNumber", "accountType", "createdAt", "id", "userId") SELECT "accountNumber", "accountType", "createdAt", "id", "userId" FROM "accounts";
DROP TABLE "accounts";
ALTER TABLE "new_accounts" RENAME TO "accounts";
CREATE UNIQUE INDEX "accounts_userId_accountNumber_key" ON "accounts"("userId", "accountNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "institutions_name_key" ON "institutions"("name");
