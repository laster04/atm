-- Turnaj Plus (celek C): tournament partners and downloadable documents. New tables only.

-- CreateTable
CREATE TABLE "tournament_sponsors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "logo" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "tournament_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "file_id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_sponsors_tournament_id_position_idx" ON "tournament_sponsors"("tournament_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_documents_file_id_key" ON "tournament_documents"("file_id");

-- CreateIndex
CREATE INDEX "tournament_documents_tournament_id_position_idx" ON "tournament_documents"("tournament_id", "position");

-- AddForeignKey
ALTER TABLE "tournament_sponsors" ADD CONSTRAINT "tournament_sponsors_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_documents" ADD CONSTRAINT "tournament_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_documents" ADD CONSTRAINT "tournament_documents_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

