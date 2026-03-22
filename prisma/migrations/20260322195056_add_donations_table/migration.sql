-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kofiTransactionId" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "message" TEXT,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "type" TEXT NOT NULL DEFAULT 'Donation',
    "rawPayload" TEXT,
    "donatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Donation_kofiTransactionId_key" ON "Donation"("kofiTransactionId");
