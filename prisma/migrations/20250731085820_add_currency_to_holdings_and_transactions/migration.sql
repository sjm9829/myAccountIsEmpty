-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_holdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "averagePrice" REAL NOT NULL,
    "currentPrice" REAL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "holdings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_holdings" ("accountId", "averagePrice", "currentPrice", "id", "quantity", "stockCode", "stockName", "updatedAt") SELECT "accountId", "averagePrice", "currentPrice", "id", "quantity", "stockCode", "stockName", "updatedAt" FROM "holdings";
DROP TABLE "holdings";
ALTER TABLE "new_holdings" RENAME TO "holdings";
CREATE UNIQUE INDEX "holdings_accountId_stockCode_key" ON "holdings"("accountId", "stockCode");
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "stockName" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "totalAmount" REAL NOT NULL,
    "fees" REAL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "transactionDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("accountId", "createdAt", "fees", "id", "price", "quantity", "stockCode", "stockName", "totalAmount", "transactionDate", "transactionType") SELECT "accountId", "createdAt", "fees", "id", "price", "quantity", "stockCode", "stockName", "totalAmount", "transactionDate", "transactionType" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
