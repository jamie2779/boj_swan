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
                throw error;
            }
        }
    }
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
//벌금은 일주일마다 초기회 되며, 월요일부터 일요일까지가 1주일이다, 벌금은 1회에 2000원, 2회에 4000원, 3회에 8000원 이런 식으로 2배씩 증가한다.
export async function getWeeklyFine(user_id, targetDate) {
    //targetDate가 포함된 주의 월요일과 일요일을 구한다.
    const target = new Date(targetDate);
    const day = target.getDay();
    const diff = target.getDate() - day + (day == 0 ? -6 : 1);
    const monday = new Date(target.setDate(diff));

    //유저 정보 조회
    const user = await getUserById(user_id);


    //월요일부터 일요일까지의 문제 해결 개수를 for문과 getProblemsSolvedByUserOnDate를 통해 구한다.
    try {
        let solvedCount = 0;
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const problemsSolved = await getProblemsSolvedByUserOnDate(user_id, date);
            const filteredProblems = user_problems.filter(
                (problemHolder) => problemHolder.problem.level >= tierInfo.limit
            )
            solvedCount += problemsSolved.length;
        }


    } catch (error) {
        console.error("Error fetching weekly fine:", error.message);
        throw error;
    }
}