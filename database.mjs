import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

//모든 is_expired가 false인 유저를 조회하는 함수
export async function getActiveUsers() {
    try {
        const activeUsers = await prisma.user.findMany({
            where: { is_expired: false },
        });
        return activeUsers;
    } catch (error) {
        console.error("Error fetching active users:", error.message);
        throw error;
    }
}

// 특정 discordId가 이미 존재하는지 확인하는 함수
export async function checkDiscordIdExists(discord_id) {
    const existingUser = await prisma.user.findUnique({
        where: { discord_id: discord_id },
    });
    return Boolean(existingUser);
}

//특정 handle이 이미 존재하는지 확인하는 함수
export async function checkHandleExists(handle) {
    const existingUser = await prisma.user.findUnique({
        where: { handle: handle },
    });
    return Boolean(existingUser);
}

// 사용자 정보 등록 함수
export async function createUser({
    discord_id,
    handle,
    tier,
    rating,
    bio,
    solved_count,
    profile_img,
}) {
    try {
        // discordId 중복 확인
        const discordIdExists = await checkDiscordIdExists(discord_id);
        if (discordIdExists) {
            throw new Error(`이미 등록된 유저입니다.`);
        }

        // handle 중복 확인
        const handleExists = await checkHandleExists(handle);
        if (handleExists) {
            throw new Error(`이미 등록된 핸들입니다.`);
        }

        // 사용자 정보 생성
        const newUser = await prisma.user.create({
            data: {
                discord_id: discord_id,
                handle: handle,
                tier: tier,
                rating: rating,
                bio: bio,
                solved_count: solved_count,
                profile_img: profile_img,
            },
        });

        console.log("User created:", newUser);
        return newUser;
    } catch (error) {
        console.error("Error creating user:", error.message);
        throw error;
    }
}

// id를 이용하여 사용자 정보 조회 함수
export async function getUserById(user_id) {
    try {
        user_id = parseInt(user_id);
        const user = await prisma.user.findUnique({
            where: { id: user_id },
        });
        return user;
    } catch (error) {
        console.error("Error fetching user:", error.message);
        throw error;
    }
}

// discordId를 이용하여 사용자 정보 조회 함수
export async function getUserByDiscordId(discord_id) {
    try {
        const user = await prisma.user.findUnique({
            where: { discord_id: discord_id },
        });
        return user;
    } catch (error) {
        console.error("Error fetching user:", error.message);
        throw error;
    }
}
//handle을 이용하여 사용자 정보 조회 함수
export async function getUserByHandle(handle) {
    try {
        const user = await prisma.user.findUnique({
            where: { handle: handle },
        });
        return user;
    } catch (error) {
        console.error("Error fetching user:", error.message);
        throw error;
    }
}

//문제 등록 함수
export async function createProblem({
    problem_id,
    problem_name,
    problem_tier,
}) {
    try {
        const newProblem = await prisma.problem.create({
            data: {
                id: problem_id,
                title: problem_name,
                level: problem_tier,
            },
        });

        console.log("Problem created:", newProblem);
        return newProblem;
    } catch (error) {
        console.error("Error creating problem:", error.message);
        throw error;
    }
}

//문제 정보 조회 함수
export async function getProblem(problem_id) {
    try {
        const problem = await prisma.problem.findUnique({
            where: { problem_id: problem_id },
        });
        return problem;
    } catch (error) {
        console.error("Error fetching problem:", error.message);
        throw error;
    }
}

//문제 홀더 등록 함수
export async function createProblemHolder({
    user_id,
    problem_id,
    strick = false,
}) {
    try {
        const newProblemHolder = await prisma.problemHolder.create({
            data: {
                user_id: user_id,
                problem_id: problem_id,
                strick: strick,
            },
        });

        console.log("Problem holder created:", newProblemHolder);
        return newProblemHolder;
    } catch (error) {
        console.error("Error creating problem holder:", error.message);
        throw error;
    }
}

//초기 문제 홀더 등록 함수
export async function createInitialProblemHolder({
    user_id,
    problem_id,
    strick = false,
}) {
    try {
        const date = new Date(); // 현재 날짜
        date.setDate(date.getDate() - 3); // 3일 전으로 설정
        const newProblemHolder = await prisma.problemHolder.create({
            data: {
                user_id: user_id,
                problem_id: problem_id,
                strick: strick,
                create_date: date,
            },
        });

        console.log("Problem holder created:", newProblemHolder);
        return newProblemHolder;
    } catch (error) {
        console.error("Error creating problem holder:", error.message);
        throw error;
    }
}

//특정 유저의 모든 문제 홀더 조회 함수
export async function getProblemHolders(user_id) {
    try {
        const problemHolders = await prisma.problemHolder.findMany({
            where: { user_id: user_id },
        });
        return problemHolders;
    } catch (error) {
        console.error("Error fetching problem holders:", error.message);
        throw error;
    }
}

//특정 문제 존재 여부 확인 함수
export async function checkProblemExists(problem_id) {
    const existingProblem = await prisma.problem.findUnique({
        where: { id: problem_id },
    });
    return Boolean(existingProblem);
}

//특정 유저가 특정 문제 홀더를 가지고 있는지 확인하는 함수
export async function checkProblemHolderExists(user_id, problem_id) {
    const existingProblemHolder = await prisma.problemHolder.findUnique({
        where: { user_id: user_id, problem_id: problem_id },
    });
    return Boolean(existingProblemHolder);
}

//유저 정보 갱신 함수
export async function updateUser(user_id, data) {
    try {
        const updatedUser = await prisma.user.update({
            where: { id: user_id },
            data: data,
        });

        console.log("User updated:", updatedUser);
        return updatedUser;
    } catch (error) {
        console.error("Error updating user:", error.message);
        throw error;
    }
}

//특정 유저가 특정 날자에 해결한 문제들을 조회하는 함수
export async function getProblemsSolvedByUserOnDate(user_id, targetDate) {
    try {
        const startDate = new Date(targetDate);
        //targetDate의 시간이 새벽 6시 이전이라면 날짜 하나 전으로 돌리기
        if (startDate.getHours() < 6) {
            startDate.setDate(startDate.getDate() - 1);
        }
        startDate.setHours(6, 0, 0, 0);

        const endDate = new Date(targetDate);
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(5, 59, 59, 999);

        const problemsSolved = await prisma.problemHolder.findMany({
            where: {
                user_id: user_id,
                create_date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                problem: true,
            },
        });

        return problemsSolved;
    } catch (error) {
        console.error("Error fetching problems solved by user:", error.message);
        throw error;
    }
}

//특정 날짜 이전에 가입한 유저들 조회하는 함수
export async function getUsersBeforeDate(targetDate) {
    try {
        const newUsers = await prisma.user.findMany({
            where: {
                create_date: {
                    lt: targetDate,
                },
            },
        });

        return newUsers;
    } catch (error) {
        console.error("Error fetching new users:", error.message);
        throw error;
    }
}

// 애플리케이션 종료 시 Prisma 클라이언트 연결 해제
process.on("beforeExit", async () => {
    await prisma.$disconnect();
    console.log("Prisma client disconnected");
});
