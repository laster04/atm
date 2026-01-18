-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "managerId" INTEGER;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
