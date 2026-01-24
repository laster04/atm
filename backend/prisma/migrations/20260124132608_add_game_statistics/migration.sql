-- CreateTable
CREATE TABLE "GameStatistic" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameId" INTEGER NOT NULL,
    "goals" INTEGER,
    "assists" INTEGER,

    CONSTRAINT "GameStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameStatistic_playerId_gameId_key" ON "GameStatistic"("playerId", "gameId");

-- AddForeignKey
ALTER TABLE "GameStatistic" ADD CONSTRAINT "GameStatistic_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStatistic" ADD CONSTRAINT "GameStatistic_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
