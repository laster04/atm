-- CreateEnum
CREATE TYPE "FileOwnerType" AS ENUM ('TEAM', 'TOURNAMENT_TEAM', 'TOURNAMENT', 'TOURNAMENT_SERIES', 'LEAGUE');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('LOGO', 'SPONSOR_LOGO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT,
    "kind" "FileKind" NOT NULL,
    "visibility" "FileVisibility" NOT NULL,
    "owner_type" "FileOwnerType",
    "owner_id" TEXT,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "source_url" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_key_key" ON "files"("key");

-- CreateIndex
CREATE UNIQUE INDEX "files_url_key" ON "files"("url");

-- CreateIndex
CREATE INDEX "files_owner_type_owner_id_idx" ON "files"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "files_created_at_idx" ON "files"("created_at");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

