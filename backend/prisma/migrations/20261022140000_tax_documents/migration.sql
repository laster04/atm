-- Celek B4: tax documents for confirmed payments, numbered per year without gaps.

-- CreateEnum
CREATE TYPE "TaxDocumentKind" AS ENUM ('SIMPLIFIED', 'FULL');

-- CreateTable
CREATE TABLE "tax_documents" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" "TaxDocumentKind" NOT NULL,
    "payment_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "tax_point_at" TIMESTAMP(3) NOT NULL,
    "content" JSONB NOT NULL,
    "file_key" TEXT,
    "emailed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_counters" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_documents_number_key" ON "tax_documents"("number");

-- CreateIndex
CREATE UNIQUE INDEX "tax_documents_payment_id_key" ON "tax_documents"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_documents_year_sequence_key" ON "tax_documents"("year", "sequence");

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
