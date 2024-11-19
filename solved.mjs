import { tierMapping } from "./tier.mjs";
import {
    getActiveUsers,
    createProblem,
    createProblemHolder,
    createInitialProblemHolder,
    getProblemHolders,
    checkProblemExists,
    getUserById,
    updateUser,
    getProblemsSolvedByUserOnDate,
} from "./database.mjs";
//유저 데이터 조회 함수
export async function getSolvedUserData(bojHandle) {
    try {
        const url = `https://solved.ac/api/v3/user/show?handle=${bojHandle}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error(`Error: ${response.statusText}`);

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching user data:", error.message);
        throw error;
    }
}

//특정 유저가 새로 푼 문제 저장 함수
export async function saveSolvedProblems(user_id, initial = false) {
    let user;
    let data;
    let holders; //기존 홀더
    let problems = []; //새로운 문제
    let problemCount = 0;
    let HolderCount = 0;

    // 사용자 정보 조회
    try {
        user = await getUserById(user_id);
    } catch (error) {
        throw new Error(`사용자 정보를 찾을 수 없습니다.`);
    }
    if (!user) {
        throw new Error(`사용자 정보를 찾을 수 없습니다.`);
    }

    try {
        holders = await getProblemHolders(user.id);
    } catch (error) {
        throw new Error(`문제 홀더를 찾을 수 없습니다.`);
    }

    try {
        const url = `https://solved.ac/api/v3/search/problem?query=@${user.handle}&direction=asc&page=1&sort=id`;
        const response = await fetch(url);

        if (!response.ok) throw new Error(`Error: ${response.statusText}`);

        data = await response.json();
        problems.push(...data.items);
    } catch (error) {
        console.error("Error fetching user data:", error.message);
        throw error;
    }

    if (holders.length === data.count) {
        console.log("No new problems to save.");
        return { problemCount, HolderCount };
    }

    const last_page = Math.ceil(data.count / 50);

    for (let page = 2; page <= last_page; page++) {
        try {
            const url = `https://solved.ac/api/v3/search/problem?query=@${user.handle}&direction=asc&page=${page}&sort=id`;
            const response = await fetch(url);

            if (!response.ok) throw new Error(`Error: ${response.statusText}`);

            data = await response.json();
            problems.push(...data.items);
        } catch (error) {
            console.error("Error fetching user data:", error.message);
            throw error;
        }
    }
    for (let problem of problems) {
        const problemExists = await checkProblemExists(problem.problemId);
        if (!problemExists) {
            try {
                await createProblem({
                    problem_id: problem.problemId,
                    problem_name: problem.titleKo,
                    problem_tier: problem.level,
                });
                problemCount++;
            } catch (error) {
                console.error("Error creating problem:", error.message);
                throw error;
            }
        }

        const holderExists = holders.some(
            (holder) => holder.problem_id === problem.problemId
        );
        if (!holderExists) {
            try {
                if (initial) {
                    await createInitialProblemHolder({
                        user_id: user.id,
                        problem_id: problem.problemId,
                    });
                    HolderCount++;
                } else {
                    await createProblemHolder({
                        user_id: user.id,
                        problem_id: problem.problemId,
                    });
                    HolderCount++;
                }
            } catch (error) {
                console.error("Error creating problem holder:", error.message);
            }
        }
    }
    console.log("new problems saved");
    return { problemCount, HolderCount };
}

//활성 사용자 문제 저장 함수
export async function saveSolvedProblemsForActiveUsers() {
    let problemCount = 0;
    let HolderCount = 0;

    try {
        const activeUsers = await getActiveUsers();
        for (let user of activeUsers) {
            const result = await saveSolvedProblems(user.id);
            problemCount += result.problemCount;
            HolderCount += result.HolderCount;
        }
    } catch (error) {
        console.error(
            "Error saving solved problems for active users:",
            error.message
        );
        throw error;
    }
    return { problemCount, HolderCount };
}

//사용자 정보 갱신 함수
export async function updateUserData(user_id) {
    try {
        const user = await getUserById(user_id);
        if (!user) {
            throw new Error(`사용자 정보를 찾을 수 없습니다.`);
        }

        const userData = await getSolvedUserData(user.handle);

        await updateUser(user.id, {
            tier: userData.tier,
            rating: userData.rating,
            bio: userData.bio,
            solved_count: userData.solvedCount,
            profile_img:
                userData.profileImageUrl ||
                "https://static.solved.ac/misc/360x360/default_profile.png",
        });
    } catch (error) {
        console.error("Error updating user data:", error.message);
        throw error;
    }
}

//활성 사용자 정보 갱신 함수
export async function updateUserDataForActiveUsers() {
    try {
        const activeUsers = await getActiveUsers();
        for (let user of activeUsers) {
            await updateUserData(user.id);
        }
    } catch (error) {
        console.error(
            "Error updating user data for active users:",
            error.message
        );
        throw error;
    }
}

//활성유저 각각에 대해 특정 날짜에 푼 문제를 조회하고 유저 id를 key로 하는 딕셔너리로 반환하는 함수
export async function getProblemsSolvedByActiveUsersOnDate(date) {
    let solvedProblems = {};
    try {
        const activeUsers = await getActiveUsers();
        for (let user of activeUsers) {
            const userData = await getProblemsSolvedByUserOnDate(user.id, date);
            solvedProblems[user.id] = userData;
        }
    } catch (error) {
        console.error(
            "Error fetching problems solved by active users on date:",
            error.message
        );
        throw error;
    }
    return solvedProblems;
}

//특정 유저의 일주일 벌금 조회 함수
//targetDate가 포함된 주 부터 targetDate이전 까지의 벌금을 조회한다.
//targetDate가 월요일이라면 지난주 벌금을 조회한다.
export async function getWeeklyUnsolve(user_id, targetDate) {
    let monday = new Date(targetDate);
    monday.setHours(6, 0, 0, 0);
    let day = monday.getDay(); // 일요일:0, 월요일:1, ..., 토요일:6

    // 일주일이 월요일부터 시작한다고 가정하므로 요일을 조정합니다.
    let adjustedDay = (day + 6) % 7; // 월요일:0, 화요일:1, ..., 일요일:6

    if (adjustedDay === 0) {
        // targetdate가 월요일인 경우 지난주 월요일을 반환
        monday.setDate(monday.getDate() - 7);
    } else {
        // targetdate가 월요일이 아닌 경우 해당 주의 월요일을 반환
        monday.setDate(monday.getDate() - adjustedDay);
    }

    let std = new Date();
    std.setHours(6, 0, 0, 0);

    //유저 정보 조회
    const user = await getUserById(user_id);
    const tierInfo = tierMapping[user.tier];

    try {
        let unsolved = 0;
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const userCreated = new Date(user.create_date);
            userCreated.setHours(6, 0, 0, 0);

            if (date <= userCreated) continue;
            if (date > std) break;
            const problemsSolved = await getProblemsSolvedByUserOnDate(
                user_id,
                date
            );
            const filteredProblems = problemsSolved.filter(
                (problemHolder) => problemHolder.problem.level >= tierInfo.limit
            );
            if (filteredProblems.length == 0) {
                unsolved += 1;
            }
        }
        return unsolved;
    } catch (error) {
        console.error("Error fetching weekly fine:", error.message);
        throw error;
    }
}
