import cron from "node-cron";
import { tierMapping } from "./tier.mjs";
import {
    Client,
    GatewayIntentBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
} from "discord.js";
import {
    getSolvedUserData,
    saveSolvedProblems,
    updateUserDataForActiveUsers,
    saveSolvedProblemsForActiveUsers,
    getProblemsSolvedByActiveUsersOnDate,
    getWeeklyUnsolve,
} from "./solved.mjs";
import {
    checkDiscordIdExists,
    createUser,
    getUserById,
    getUserByDiscordId,
} from "./database.mjs";
import dotenv from "dotenv";

dotenv.config();

let UpdateCooltime = new Date();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const EmbedFooterImageUrl =
    "https://cdn.discordapp.com/avatars/1305799574774087691/e5c81e2ac05a6892de19d5e4e479dda4";
const EmbedFooterText =
    "모든 정보는 오후 6시 30분과 새벽 6시 30분에 업데이트됩니다.";

// 봇이 준비되었을 때 실행할 코드
client.once("ready", () => {
    console.log("봇이 준비되었습니다!");

    // 특정 시간에 메시지를 보내는 스케줄러 설정
    const channelId = process.env.ANNOUNCEMENT_CHANNEL_ID; // 메시지를 보낼 채널의 ID를 입력하세요

    cron.schedule("55 * * * *", async () => {
        //유저 정보 갱신
        try {
            await updateUserDataForActiveUsers();
        } catch (error) {
            console.error("유저 정보 갱신 중 오류 발생:", error);
        }

        //유저 문제 정보 갱신
        try {
            await saveSolvedProblemsForActiveUsers();
        } catch (error) {
            console.error("유저 문제 정보 갱신 중 오류 발생:", error);
        }
    });

    cron.schedule("30 6 * * *", async () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // getMonth()는 0부터 시작하므로 1을 더해줍니다.
        const day = today.getDate() - 1;
        const formattedDate = `${year}-${String(month).padStart(
            2,
            "0"
        )}-${String(day).padStart(2, "0")}`;

        const channel = await client.channels.fetch(channelId);
        let problems;
        try {
            problems = await getProblemsSolvedByActiveUsersOnDate(
                formattedDate
            );
        } catch (error) {
            console.error(
                "특정 날짜에 해결한 문제들을 불러오는 도중 오류가 발생했습니다:",
                error
            );
        }

        console.log(problems);
        //problems라는 object를 value의 길이 내림차순으로 정렬
        const sortedProblems = Object.fromEntries(
            Object.entries(problems).sort(([, a], [, b]) => b.length - a.length)
        );

        for (const [user_id, user_problems] of Object.entries(sortedProblems)) {
            const user = await getUserById(user_id);
            let embed;
            const tierInfo = tierMapping[user.tier];
            const filteredProblems = user_problems.filter(
                (problemHolder) => problemHolder.problem.level >= tierInfo.limit
            );
            if (filteredProblems.length > 0) {
                embed = new EmbedBuilder()
                    .setColor(0xadff2f)
                    .setTitle(
                        `${user.handle}님이 ${formattedDate}의 문제를 풀었습니다.`
                    )
                    .setDescription(
                        `오늘 푼 문제 수: ${user_problems.length}, 조건에 맞는 문제 수: ${filteredProblems.length}`
                    )
                    .setFooter({
                        text: EmbedFooterText,
                        iconURL: EmbedFooterImageUrl,
                    });
            } else {
                embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle(
                        `${user.handle}님이 ${formattedDate}의 문제를 풀지 않았습니다.`
                    )
                    .setDescription(
                        `오늘 푼 문제 수: ${user_problems.length
                        }, 조건에 맞는 문제 수: ${user_problems.filter(
                            (problem) => problem.level >= tierInfo.limit
                        ).length
                        }`
                    )
                    .setFooter({
                        text: EmbedFooterText,
                        iconURL: EmbedFooterImageUrl,
                    });
            }

            try {
                // 지정된 채널 ID로 채널 객체 가져오기
                const channel = await client.channels.fetch(channelId);

                // 채널에 embed 메시지 전송
                await channel.send({ embeds: [embed] });

                console.log(
                    `ANNOUNCEMENT_CHANNEL_ID(${channelId}) 채널로 메시지가 성공적으로 전송되었습니다.`
                );
            } catch (error) {
                console.error(
                    `메시지를 보내는 도중 오류가 발생했습니다: ${error}`
                );
            }
        }
    });

    // 매일 저녁 6시마다 메시지 전송 (0 18 * * *)
    cron.schedule("30 18 * * *", async () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // getMonth()는 0부터 시작하므로 1을 더해줍니다.
        const day = today.getDate();
        const formattedDate = `${year}-${String(month).padStart(
            2,
            "0"
        )}-${String(day).padStart(2, "0")}`;

        const channel = await client.channels.fetch(channelId);
        let problems;
        try {
            problems = await getProblemsSolvedByActiveUsersOnDate(
                formattedDate
            );
        } catch (error) {
            console.error(
                "특정 날짜에 해결한 문제들을 불러오는 도중 오류가 발생했습니다:",
                error
            );
        }

        console.log(problems);
        for (const [user_id, user_problems] of Object.entries(problems)) {
            const filteredProblems = user_problems.filter(
                (problemHolder) => problemHolder.problem.level >= tierInfo.limit
            );
            if (filteredProblems.length > 0) continue;
            const user = await getUserById(user_id);

            const tierInfo = tierMapping[user.tier];
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(`아직 ${formattedDate}의 문제를 풀지 않았습니다.`)
                .setDescription(
                    `오늘 푼 문제 수: ${user_problems.length}, 조건에 맞는 문제 수: ${filteredProblems.length}`
                )
                .setFooter({
                    text: EmbedFooterText,
                    iconURL: EmbedFooterImageUrl,
                });

            try {
                const discordUser = await client.users.fetch(user.discord_id);
                await discordUser.send({ embeds: [embed] });
                console.log(
                    `DM이 ${user.discord_id}에게 성공적으로 전송되었습니다.`
                );
            } catch (error) {
                console.error(`DM을 보내는 도중 오류가 발생했습니다: ${error}`);
            }
        }
    });

    // 일요일 오전 6시마다 메시지 전송 (30 6 * * 1)
    cron.schedule("28 23 * * *", async () => {
        console.log("test");
        //공지방에 벌금 목록 올리기
        const channel = await client.channels.fetch(channelId);
        const activeUsers = await getActiveUsers();
        for (const user of activeUsers) {
            const unsolved = await getWeeklyUnsolve(user.id, new Date());
            const nickname = await getDiscordNickname(
                channel.guild.id,
                user.discord_id
            );
            let embed;
            if (unsolved > 0) {
                embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle(`${nickname}님의 이번 주 벌금`)
                    .setDescription(`https://solved.ac/profile/${user.handle}`)
                    .setThumbnail(user.profile_img)
                    .addFields({
                        name: "안 푼 문제 수",
                        value: `${unsolved}개`,
                        inline: true,
                    })
                    .addFields({
                        name: "벌금",
                        value: `${Math.pow(2, unsolved) * 1000}원`,
                        inline: true,
                    })
                    .setFooter({
                        text: EmbedFooterText,
                        iconURL: EmbedFooterImageUrl,
                    });
            } else {
                embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle(`${nickname}님의 이번 주 벌금`)
                    .setDescription(`https://solved.ac/profile/${user.handle}`)
                    .setThumbnail(user.profile_img)
                    .addFields({
                        name: "안 푼 문제 수",
                        value: `${unsolved}개`,
                        inline: true,
                    })
                    .addFields({
                        name: "벌금",
                        value: "0원",
                        inline: true,
                    })
                    .setFooter({
                        text: EmbedFooterText,
                        iconURL: EmbedFooterImageUrl,
                    });
            }
            await channel.send({ embeds: [embed] });
        }
    });
});

// 슬래시 명령어 처리
client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
        const { commandName } = interaction;

        if (commandName === "등록") {
            const exist = await checkDiscordIdExists(interaction.user.id);
            if (exist) {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000) // 실패를 나타내는 빨간색
                    .setTitle("등록 실패")
                    .setDescription("사용자 정보 등록에 실패했습니다.")
                    .addFields({
                        name: "오류 메시지",
                        value: "이미 등록된 유저입니다",
                        inline: false,
                    })
                    .setTimestamp()
                    .setFooter({
                        text: EmbedFooterText,
                        iconURL: EmbedFooterImageUrl,
                    });

                // 임베드 메시지 전송
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            const registerModal = new ModalBuilder()
                .setCustomId(`registerModal-${interaction.user.id}`) // 유저마다 고유하게 CustomId 생성
                .setTitle("BOJ Handle 등록");

            const bojHandleInput = new TextInputBuilder()
                .setCustomId("bojHandle")
                .setLabel("BOJ Handle을 입력하세요")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(3)
                .setMaxLength(20);

            const userInputActionRow = new ActionRowBuilder().addComponents(
                bojHandleInput
            );
            registerModal.addComponents(userInputActionRow);

            await interaction.showModal(registerModal);
        } else if (commandName === "정보") {
            if (!interaction.guild) {
                await interaction.reply({
                    content: "이 명령어는 서버에서만 사용할 수 있습니다.",
                    ephemeral: true,
                });
                return;
            }

            try {
                // 유저 존재여부 확인
                if (await checkDiscordIdExists(interaction.user.id)) {
                    const target_user =
                        interaction.options.getUser("user") || interaction.user;

                    // 사용자 정보 불러오기
                    const user = await getUserByDiscordId(target_user.id);

                    // 사용자 정보가 없을 경우
                    if (!user) {
                        await interaction.reply({
                            content: "등록된 사용자 정보가 없습니다.",
                            ephemeral: true,
                        });
                        return;
                    }

                    const nickname = await getDiscordNickname(
                        interaction.guild.id,
                        user.discord_id
                    );

                    const tierInfo = tierMapping[user.tier];
                    const fields = [
                        {
                            name: "디스코드 닉네임",
                            value: nickname || "N/A",
                            inline: true,
                        },
                        {
                            name: "boj 핸들",
                            value: user.handle || "N/A",
                            inline: true,
                        },
                    ];

                    if (user.bio)
                        fields.push({
                            name: "자기소개",
                            value: user.bio,
                            inline: false,
                        });
                    if (user.solved_count)
                        fields.push({
                            name: "푼 문제 수",
                            value: `${user.solved_count}`,
                            inline: true,
                        });
                    if (user.tier)
                        fields.push({
                            name: "티어",
                            value: tierInfo.tier,
                            inline: true,
                        });

                    if (user.rating)
                        fields.push({
                            name: "레이팅",
                            value: `${user.rating}`,
                            inline: true,
                        });
                    if (user.create_date)
                        fields.push({
                            name: "등록 날짜",
                            value: new Date(
                                user.create_date
                            ).toLocaleDateString(),
                            inline: false,
                        });

                    const embed = new EmbedBuilder()
                        .setColor(tierInfo.color) // 티어에 맞는 색상 설정
                        .setTitle(`유저 정보 (${user.handle})`)
                        .setDescription(
                            `https://solved.ac/profile/${user.handle}`
                        )
                        .setThumbnail(user.profile_img) // 사용자 프로필 이미지
                        .addFields(fields)
                        .setFooter({
                            text: EmbedFooterText,
                            iconURL: EmbedFooterImageUrl,
                        });

                    // 임베드 메시지 전송
                    await interaction.reply({ embeds: [embed] });
                } else {
                    await interaction.reply({
                        content: "등록된 사용자 정보가 없습니다.",
                        ephemeral: true,
                    });
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: "사용자 정보를 불러오는 도중 문제가 발생했습니다.",
                    ephemeral: true,
                });
            }
        } else if (commandName === "벌금") {
            if (!interaction.guild) {
                await interaction.reply({
                    content: "이 명령어는 서버에서만 사용할 수 있습니다.",
                    ephemeral: true,
                });
                return;
            }

            try {
                // 유저 존재여부 확인
                if (await checkDiscordIdExists(interaction.user.id)) {
                    const target_user =
                        interaction.options.getUser("user") || interaction.user;

                    // 사용자 정보 불러오기
                    const user = await getUserByDiscordId(target_user.id);

                    // 사용자 정보가 없을 경우
                    if (!user) {
                        await interaction.reply({
                            content: "등록된 사용자 정보가 없습니다.",
                            ephemeral: true,
                        });
                        return;
                    }

                    const unsolved = await getWeeklyUnsolve(
                        user.id,
                        new Date()
                    );

                    const nickname = await getDiscordNickname(
                        interaction.guild.id,
                        user.discord_id
                    );

                    let embed;
                    if (unsolved > 0) {
                        //벌금 안내 임베드 메시지 생성
                        embed = new EmbedBuilder()
                            .setColor(0xff0000) // 벌금을 나타내는 빨간색
                            .setTitle(`${nickname}님의 이번 주 벌금`)
                            .setDescription(
                                `https://solved.ac/profile/${user.handle}`
                            )
                            .setThumbnail(user.profile_img) // 사용자 프로필 이미지
                            .addFields({
                                name: "안 푼 문제 수",
                                value: `${unsolved}개`,
                                inline: true,
                            })
                            .addFields({
                                name: "벌금",
                                value: `${Math.pow(2, unsolved) * 1000}원`,
                                inline: true,
                            })
                            .setFooter({
                                text: EmbedFooterText,
                                iconURL: EmbedFooterImageUrl,
                            });
                    } else {
                        //벌금 없음 안내 임베드 메시지 생성
                        embed = new EmbedBuilder()
                            .setColor(0x00ff00) // 벌금 없음을 나타내는 초록색
                            .setTitle(`${nickname}님의 이번 주 벌금`)
                            .setDescription(
                                `https://solved.ac/profile/${user.handle}`
                            )
                            .setThumbnail(user.profile_img) // 사용자 프로필 이미지
                            .addFields({
                                name: "안 푼 문제 수",
                                value: `${unsolved}개`,
                                inline: true,
                            })
                            .addFields({
                                name: "벌금",
                                value: "0원",
                                inline: true,
                            })
                            .setFooter({
                                text: EmbedFooterText,
                                iconURL: EmbedFooterImageUrl,
                            });
                    }
                    // 임베드 메시지 전송
                    await interaction.reply({ embeds: [embed] });
                } else {
                    await interaction.reply({
                        content: "등록된 사용자 정보가 없습니다.",
                        ephemeral: true,
                    });
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: "사용자 정보를 불러오는 도중 문제가 발생했습니다.",
                    ephemeral: true,
                });
            }
        } else if (commandName === "강제갱신") {
            if (!interaction.guild) {
                await interaction.reply({
                    content: "이 명령어는 서버에서만 사용할 수 있습니다.",
                    ephemeral: true,
                });
                return;
            }
            //해당 명령어 쿨타임 1시간
            const now = new Date();
            if (now < UpdateCooltime) {
                await interaction.reply({
                    content: "강제 갱신은 1시간에 한 번만 할 수 있습니다.",
                    ephemeral: true,
                });
            } else {
                //유저 정보 갱신
                updateUserDataForActiveUsers()
                    .then(() => {
                        saveSolvedProblemsForActiveUsers().catch((error) => {
                            console.error(
                                "유저 문제 정보 갱신 중 오류 발생:",
                                error
                            );
                        });
                    })
                    .catch((error) => {
                        console.error("유저 정보 갱신 중 오류 발생:", error);
                    });
                //정보 갱신 요청을 보냈다고 알림
                await interaction.reply({
                    content: "유저 정보와 문제 정보 갱신 요청을 보냈습니다.",
                    ephemeral: true,
                });
                now.setHours(now.getHours() + 1);
                UpdateCooltime = now;
            }
        }
    } else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("registerModal")) {
            const bojHandle = interaction.fields.getTextInputValue("bojHandle");

            try {
                // 사용자 정보 불러오기
                const userData = await getSolvedUserData(bojHandle);
                console.log("User data:", userData);

                // 사용자 정보 등록
                const user = await createUser({
                    discord_id: interaction.user.id,
                    handle: bojHandle,
                    tier: userData.tier,
                    rating: userData.rating,
                    bio: userData.bio,
                    solved_count: userData.solvedCount,
                    profile_img:
                        userData.profileImageUrl ||
                        "https://static.solved.ac/misc/360x360/default_profile.png",
                });

                const nickname = await getDiscordNickname(
                    interaction.guild.id,
                    user.discord_id
                );

                const tierInfo = tierMapping[user.tier];

                const fields = [
                    {
                        name: "디스코드 닉네임",
                        value: nickname || "N/A",
                        inline: true,
                    },
                    {
                        name: "boj 핸들",
                        value: user.handle || "N/A",
                        inline: true,
                    },
                ];

                if (user.bio)
                    fields.push({
                        name: "자기소개",
                        value: user.bio,
                        inline: false,
                    });
                if (user.solved_count)
                    fields.push({
                        name: "푼 문제 수",
                        value: `${user.solved_count}`,
                        inline: true,
                    });
                if (user.tier)
                    fields.push({
                        name: "티어",
                        value: tierInfo.tier,
                        inline: true,
                    });

                if (user.rating)
                    fields.push({
                        name: "레이팅",
                        value: `${user.rating}`,
                        inline: true,
                    });
                if (user.create_date)
                    fields.push({
                        name: "등록 날짜",
                        value: new Date(user.create_date).toLocaleDateString(),
                        inline: false,
                    });

                // 등록 성공 임베드 메시지 생성
                const embed = new EmbedBuilder()
                    .setColor(tierInfo.color) // 티어에 맞는 색상 설정
                    .setTitle(`유저 정보 (${user.handle})`)
                    .setDescription(`https://solved.ac/profile/${user.handle}`)
                    .setThumbnail(user.profile_img) // 사용자 프로필 이미지
                    .addFields(fields)
                    .setFooter({
                        text: EmbedFooterText,
                        iconURL: EmbedFooterImageUrl,
                    });
                //푼 문제 등록
                saveSolvedProblems(user.id).catch((error) => {
                    console.error("푼 문제 등록 중 오류 발생:", error);
                });

                // 임베드 메시지 전송
                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                // 등록 실패 임베드 메시지 생성
                const embed = new EmbedBuilder()
                    .setColor(0xff0000) // 실패를 나타내는 빨간색
                    .setTitle("등록 실패")
                    .setDescription("사용자 정보 등록에 실패했습니다.")
                    .addFields({
                        name: "오류 메시지",
                        value: error.message,
                        inline: false,
                    })
                    .setTimestamp()
                    .setFooter({
                        text: EmbedFooterText,
                        iconURL: EmbedFooterImageUrl,
                    });

                // 임베드 메시지 전송
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    }
});

export async function getDiscordNickname(guild_id, discord_id) {
    try {
        const guild = await client.guilds.fetch(guild_id);
        const member = await guild.members.fetch(discord_id);
        return member.displayName;
    } catch (error) {
        console.error("닉네임을 불러오는 도중 오류가 발생했습니다:", error);
        return "undefined";
    }
}

client.login(process.env.DISCORD_BOT_TOKEN);
