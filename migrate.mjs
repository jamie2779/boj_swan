import { PrismaClient } from "@prisma/client";
import { tierMapping } from "./tier.mjs";

const prisma = new PrismaClient();

async function migrateProblemHolders() {
    console.log("Migrating database...");

    try {
        //모든 문제 홀더 조회
        const holders = await prisma.problemHolder.findMany();

        //각 문제 홀더에 대해서 유저정보 및 문제정보를 조회
        for (let holder of holders) {
            const user = await prisma.user.findUnique({
                where: { id: holder.user_id },
            });
            const problem = await prisma.problem.findUnique({
                where: { id: holder.problem_id },
            });

            if (!holder.strick) {
                const tierInfo = tierMapping[user.tier];
                if (problem.level >= tierInfo.limit) {
                    await prisma.problemHolder.update({
                        where: { id: holder.id },
                        data: { strick: true },
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error fetching problem holders:", error.message);
        throw error;
    }
    console.log("Database migration complete");
}

// 애플리케이션 종료 시 Prisma 클라이언트 연결 해제
process.on("beforeExit", async () => {
    await prisma.$disconnect();
    console.log("Prisma client disconnected");
});

await migrateProblemHolders();
