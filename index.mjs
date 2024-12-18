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
    StringSelectMenuBuilder,
} from "discord.js";
import {
    getSolvedUserData,
    saveSolvedProblems,
    updateUserDataForActiveUsers,
    saveSolvedProblemsForActiveUsers,
    getProblemsSolvedByActiveUsersOnDate,
    updateUserData,
} from "./solved.mjs";
import {
    checkDiscordIdExists,
    createUser,
    getUserById,
    getUserByDiscordId,
    getProblemsSolvedByUserOnDate,
    updateUser,
    getUsersBeforeDate,
} from "./database.mjs";
import dotenv from "dotenv";

dotenv.config();

let updateCooltime = new Date();
let strickCooltime = {};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const EmbedFooterImageUrl =
    "https://cdn.discordapp.com/avatars/1305799574774087691/e5c81e2ac05a6892de19d5e4e479dda4";
const EmbedFooterText = "유저 및 문제 정보는 매시 55분에 갱신됩니다.";

function formatDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    let day = date.getDate();
    const formattedDate = `${year}-${String(month).padStart(2, "0")}-${String(
        day
    ).padStart(2, "0")}`;

    return formattedDate;
}

// 봇이 준비되었을 때 실행할 코드
client.once("ready", () => {
    console.log("봇이 준비되었습니다!");

    // 특정 시간에 메시지를 보내는 스케줄러 설정
    const channelId = process.env.ANNOUNCEMENT_CHANNEL_ID; // 메시지를 보낼 채널의 ID를 입력하세요

    cron.schedule("55 * * * *", async () => {
        //유저 문제 정보 갱신
        try {
            await saveSolvedProblemsForActiveUsers();
        } catch (error) {
            console.error("유저 문제 정보 갱신 중 오류 발생:", error);
        }

        //유저 정보 갱신
        try {
            await updateUserDataForActiveUsers();
        } catch (error) {
            console.error("유저 정보 갱신 중 오류 발생:", error);
        }
    });

    //초기와 직전 문제 갱신
    cron.schedule("59 5 * * *", async () => {
        //유저 문제 정보 갱신
        try {
            await saveSolvedProblemsForActiveUsers();
        } catch (error) {
            console.error("유저 문제 정보 갱신 중 오류 발생:", error);
        }

        //유저 정보 갱신
        try {
            await updateUserDataForActiveUsers();
        } catch (error) {
            console.error("유저 정보 갱신 중 오류 발생:", error);
        }
    });

    //매일 새벽 6시 30분 마다 메시지 전송 (30 6 * * *)
    cron.schedule("30 6 * * *", async () => {
        const today = new Date();
        today.setHours(5, 59, 59, 0);
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
            problems = await getProblemsSolvedByActiveUsersOnDate(today);
        } catch (error) {
            console.error(
                "특정 날짜에 해결한 문제들을 불러오는 도중 오류가 발생했습니다:",
                error
            );
        }

        let stricks = "";
        let strickCount = 0;
        let notStrickCount = 0;
        for (const [user_id, user_problems] of Object.entries(problems)) {
            const user = await getUserById(user_id);
            const filteredProblems = user_problems.filter(
                (problemHolder) => problemHolder.strick
            );
            if (filteredProblems.length > 0) {
                stricks += `:white_check_mark:  ${user.handle} [${filteredProblems.length}문제/${user_problems.length}문제]\n `;
                strickCount++;
            } else {
                stricks += `:x:  ${user.handle} [${filteredProblems.length}문제/${user_problems.length}문제]\n `;
                notStrickCount++;
            }
        }
        const embed = new EmbedBuilder()
            .setColor(0xadff2f)
            .setTitle(`${formattedDate} 스트릭 목록`)
            .addFields([
                {
                    name: `성공: ${strickCount}명, 실패: ${notStrickCount}명`,
                    value: stricks,
                    inline: false,
                },
            ])
            .setFooter({
                text: EmbedFooterText,
                iconURL: EmbedFooterImageUrl,
            });

        try {
            // 지정된 채널 ID로 채널 객체 가져오기
            const channel = await client.channels.fetch(channelId);

            // 채널에 embed 메시지 전송
            await channel.send({ embeds: [embed] });

            console.log(
                `ANNOUNCEMENT_CHANNEL_ID(${channelId}) 채널로 메시지가 성공적으로 전송되었습니다.`
            );
        } catch (error) {
            console.error(`메시지를 보내는 도중 오류가 발생했습니다: ${error}`);
        }
    });

    // 정해진 시간에 알림 메시지 전송 매시 30분 설정 (30 * * * *)
    cron.schedule("30 * * * *", async () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // getMonth()는 0부터 시작하므로 1을 더해줍니다.
        const day = today.getDate();
        const formattedDate = `${year}-${String(month).padStart(
            2,
            "0"
        )}-${String(day).padStart(2, "0")}`;

        let problems;
        try {
            problems = await getProblemsSolvedByActiveUsersOnDate(today);
        } catch (error) {
            console.error(
                "특정 날짜에 해결한 문제들을 불러오는 도중 오류가 발생했습니다:",
                error
            );
        }

        for (const [user_id, user_problems] of Object.entries(problems)) {
            const user = await getUserById(user_id);
            const now = new Date();
            if (now.getHours() === user.notice_time) {
                const filteredProblems = user_problems.filter(
                    (problemHolder) => problemHolder.strick
                );
                if (filteredProblems.length > 0) continue;

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
                    const discordUser = await client.users.fetch(
                        user.discord_id
                    );
                    await discordUser.send({ embeds: [embed] });
                    console.log(
                        `DM이 ${user.discord_id}에게 성공적으로 전송되었습니다.`
                    );
                } catch (error) {
                    console.error(
                        `DM을 보내는 도중 오류가 발생했습니다: ${error}`
                    );
                }
            }
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
                    .setColor(0xff0000) //빨간색
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
        } else if (commandName === "알림") {
            if (await checkDiscordIdExists(interaction.user.id)) {
                // 알림 켜기/끄기 드롭다운 생성
                const toggleMenu = new StringSelectMenuBuilder()
                    .setCustomId(`toggleNotification-${interaction.user.id}`) // 고유 ID
                    .setPlaceholder("DM 알림 여부를 설정하세요")
                    .addOptions(
                        {
                            label: "켜기",
                            value: "on",
                            description: "DM 알림을 켭니다",
                        },
                        {
                            label: "끄기",
                            value: "off",
                            description: "DM 알림을 끕니다",
                        }
                    );

                const toggleActionRow = new ActionRowBuilder().addComponents(
                    toggleMenu
                );

                // 드롭다운 메시지 전송
                await interaction.reply({
                    content: "DM 알림을 설정하세요:",
                    components: [toggleActionRow],
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: "등록된 사용자 정보가 없습니다.",
                    ephemeral: true,
                });
            }
        } else if (commandName === "정보") {
            if (!interaction.guild) {
                await interaction.reply({
                    content: "이 명령어는 서버에서만 사용할 수 있습니다.",
                    ephemeral: true,
                });
                return;
            }
            await interaction.deferReply();
            try {
                // 유저 존재여부 확인
                if (await checkDiscordIdExists(interaction.user.id)) {
                    const target_user =
                        interaction.options.getUser("user") || interaction.user;

                    // 사용자 정보 불러오기
                    const user = await getUserByDiscordId(target_user.id);

                    // 사용자 정보가 없을 경우
                    if (!user) {
                        await interaction.editReply({
                            content: "등록된 사용자 정보가 없습니다.",
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
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({
                        content: "등록된 사용자 정보가 없습니다.",
                    });
                }
            } catch (error) {
                try {
                    await interaction.editReply({
                        content:
                            "사용자 정보를 불러오는 도중 문제가 발생했습니다.",
                    });
                } catch (error) {
                    console.error(error);
                }
                console.error(error);
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
            if (now < updateCooltime) {
                await interaction.reply({
                    content: "강제 갱신은 1시간에 한 번만 할 수 있습니다.",
                    ephemeral: true,
                });
            } else {
                //정보 갱신 요청을 보냈다고 알림
                await interaction.reply({
                    content: "유저 정보와 문제 정보 갱신 요청을 보냈습니다.",
                    ephemeral: true,
                });

                //유저 문제 정보 갱신
                try {
                    await saveSolvedProblemsForActiveUsers();
                } catch (error) {
                    console.error("문제 정보 갱신 중 오류 발생:", error);
                    await interaction.editReply({
                        content: `문제 정보 갱신 중 오류 발생: ${error}`,
                        ephemeral: true,
                    });
                    return;
                }

                //유저 정보 갱신
                try {
                    await updateUserDataForActiveUsers();
                } catch (error) {
                    console.error("유저 정보 갱신 중 오류 발생:", error);
                    await interaction.editReply({
                        content: `유저 정보 갱신 중 오류 발생: ${error}`,
                        ephemeral: true,
                    });
                    return;
                }

                await interaction.editReply({
                    content: `유저 정보와 문제 정보 갱신이 완료되었습니다.`,
                    ephemeral: true,
                });

                now.setHours(now.getHours() + 1);
                updateCooltime = now;
            }
        } else if (commandName === "스트릭") {
            if (!interaction.guild) {
                await interaction.reply({
                    content: "이 명령어는 서버에서만 사용할 수 있습니다.",
                    ephemeral: true,
                });
                return;
            }

            try {
                await interaction.deferReply();

                //해당 명령어 쿨타임 5분
                const now = new Date();
                if (strickCooltime[interaction.user.id]) {
                    if (now < strickCooltime[interaction.user.id]) {
                        await interaction.editReply({
                            content:
                                "스트릭 명령어는 5분에에 한 번만 사용 할 수 있습니다.",
                            ephemeral: true,
                        });
                        return;
                    }
                }

                // 유저 존재여부 확인
                if (await checkDiscordIdExists(interaction.user.id)) {
                    const target_user =
                        interaction.options.getUser("user") || interaction.user;

                    // 사용자 정보 불러오기
                    const user = await getUserByDiscordId(target_user.id);

                    // 사용자 정보가 없을 경우
                    if (!user) {
                        await interaction.editReply({
                            content: "등록된 사용자 정보가 없습니다.",
                            ephemeral: true,
                        });
                        return;
                    }

                    const dateInput = interaction.options.getString("date");
                    let targetDate;
                    //targetdate가 null이면
                    if (dateInput) {
                        //입력된 날짜가 new Date()로 변환 가능한지 확인
                        if (isNaN(new Date(`${dateInput}`))) {
                            await interaction.editReply({
                                content:
                                    "날짜 형식이 잘못되었습니다.(YYYY-MM-DD)",
                                ephemeral: true,
                            });
                            return;
                        }

                        try {
                            targetDate = new Date(`${dateInput}`);
                        } catch (error) {
                            console.error("날짜 변환 중 오류 발생:", error);
                            await interaction.editReply({
                                content: "날짜 변환 중 오류가 발생했습니다.",
                                ephemeral: true,
                            });
                            return;
                        }
                    } else {
                        targetDate = new Date();
                    }

                    //유저 문제 정보 갱신
                    try {
                        await saveSolvedProblems(user.id);
                    } catch (error) {
                        console.error(
                            "유저 문제 정보 갱신 중 오류 발생:",
                            error
                        );
                    }

                    //유저 정보 갱신
                    try {
                        await updateUserData(user.id);
                    } catch (error) {
                        console.error("유저 정보 갱신 중 오류 발생:", error);
                    }

                    const year = targetDate.getFullYear();
                    const month = targetDate.getMonth() + 1; // getMonth()는 0부터 시작하므로 1을 더해줍니다.
                    let day = targetDate.getDate();
                    if (targetDate.getHours() < 6) day -= 1;
                    const formattedDate = `${year}-${String(month).padStart(
                        2,
                        "0"
                    )}-${String(day).padStart(2, "0")}`;

                    let user_problems;
                    try {
                        user_problems = await getProblemsSolvedByUserOnDate(
                            user.id,
                            targetDate
                        );
                    } catch (error) {
                        console.error(
                            "특정 날짜에 해결한 문제들을 불러오는 도중 오류가 발생했습니다:",
                            error
                        );
                    }

                    let embed;
                    const tierInfo = tierMapping[user.tier];
                    const filteredProblems = user_problems.filter(
                        (problemHolder) => problemHolder.strick
                    );
                    if (filteredProblems.length > 0) {
                        embed = new EmbedBuilder()
                            .setColor(0xadff2f)
                            .setTitle(
                                `${user.handle}님이 ${formattedDate}의 문제를 풀었습니다.`
                            )
                            .setDescription(
                                `푼 문제 수: ${user_problems.length}, 조건에 맞는 문제 수: ${filteredProblems.length}`
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
                                `푼 문제 수: ${user_problems.length}, 조건에 맞는 문제 수: ${filteredProblems.length}`
                            )
                            .setFooter({
                                text: EmbedFooterText,
                                iconURL: EmbedFooterImageUrl,
                            });
                    }

                    await interaction.editReply({
                        embeds: [embed],
                    });

                    //쿨타임 설정
                    now.setMinutes(now.getMinutes() + 5);
                    strickCooltime[interaction.user.id] = now;
                } else {
                    await interaction.editReply({
                        content: "등록된 사용자 정보가 없습니다.",
                        ephemeral: true,
                    });
                    return;
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: "스트릭 정보를 불러오는 도중 문제가 발생했습니다.",
                    ephemeral: true,
                });
                return;
            }
        } else if (commandName === "스트릭") {
            if (!interaction.guild) {
                await interaction.reply({
                    content: "이 명령어는 서버에서만 사용할 수 있습니다.",
                    ephemeral: true,
                });
                return;
            }

            try {
                await interaction.deferReply();

                //해당 명령어 쿨타임 5분
                const now = new Date();
                if (strickCooltime[interaction.user.id]) {
                    if (now < strickCooltime[interaction.user.id]) {
                        await interaction.editReply({
                            content:
                                "스트릭 명령어는 5분에에 한 번만 사용 할 수 있습니다.",
                            ephemeral: true,
                        });
                        return;
                    }
                }

                // 유저 존재여부 확인
                if (await checkDiscordIdExists(interaction.user.id)) {
                    const target_user =
                        interaction.options.getUser("user") || interaction.user;

                    // 사용자 정보 불러오기
                    const user = await getUserByDiscordId(target_user.id);

                    // 사용자 정보가 없을 경우
                    if (!user) {
                        await interaction.editReply({
                            content: "등록된 사용자 정보가 없습니다.",
                            ephemeral: true,
                        });
                        return;
                    }

                    const dateInput = interaction.options.getString("date");
                    let targetDate;
                    //targetdate가 null이면
                    if (dateInput) {
                        //입력된 날짜가 new Date()로 변환 가능한지 확인
                        if (isNaN(new Date(`${dateInput}`))) {
                            await interaction.editReply({
                                content:
                                    "날짜 형식이 잘못되었습니다.(YYYY-MM-DD)",
                                ephemeral: true,
                            });
                            return;
                        }

                        try {
                            targetDate = new Date(`${dateInput}`);
                        } catch (error) {
                            console.error("날짜 변환 중 오류 발생:", error);
                            await interaction.editReply({
                                content: "날짜 변환 중 오류가 발생했습니다.",
                                ephemeral: true,
                            });
                            return;
                        }
                    } else {
                        targetDate = new Date();
                    }

                    //유저 문제 정보 갱신
                    try {
                        await saveSolvedProblems(user.id);
                    } catch (error) {
                        console.error(
                            "유저 문제 정보 갱신 중 오류 발생:",
                            error
                        );
                    }

                    //유저 정보 갱신
                    try {
                        await updateUserData(user.id);
                    } catch (error) {
                        console.error("유저 정보 갱신 중 오류 발생:", error);
                    }

                    const year = targetDate.getFullYear();
                    const month = targetDate.getMonth() + 1; // getMonth()는 0부터 시작하므로 1을 더해줍니다.
                    let day = targetDate.getDate();
                    if (targetDate.getHours() < 6) day -= 1;
                    const formattedDate = `${year}-${String(month).padStart(
                        2,
                        "0"
                    )}-${String(day).padStart(2, "0")}`;

                    let user_problems;
                    try {
                        user_problems = await getProblemsSolvedByUserOnDate(
                            user.id,
                            targetDate
                        );
                    } catch (error) {
                        console.error(
                            "특정 날짜에 해결한 문제들을 불러오는 도중 오류가 발생했습니다:",
                            error
                        );
                    }

                    let embed;
                    const tierInfo = tierMapping[user.tier];
                    const filteredProblems = user_problems.filter(
                        (problemHolder) => problemHolder.strick
                    );
                    if (filteredProblems.length > 0) {
                        embed = new EmbedBuilder()
                            .setColor(0xadff2f)
                            .setTitle(
                                `${user.handle}님이 ${formattedDate}의 문제를 풀었습니다.`
                            )
                            .setDescription(
                                `푼 문제 수: ${user_problems.length}, 조건에 맞는 문제 수: ${filteredProblems.length}`
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
                                `푼 문제 수: ${user_problems.length}, 조건에 맞는 문제 수: ${filteredProblems.length}`
                            )
                            .setFooter({
                                text: EmbedFooterText,
                                iconURL: EmbedFooterImageUrl,
                            });
                    }

                    await interaction.editReply({
                        embeds: [embed],
                    });

                    //쿨타임 설정
                    now.setMinutes(now.getMinutes() + 5);
                    strickCooltime[interaction.user.id] = now;
                } else {
                    await interaction.editReply({
                        content: "등록된 사용자 정보가 없습니다.",
                        ephemeral: true,
                    });
                    return;
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: "스트릭 정보를 불러오는 도중 문제가 발생했습니다.",
                    ephemeral: true,
                });
                return;
            }
        } else if (commandName === "기록") {
            if (!interaction.guild) {
                await interaction.reply({
                    content: "이 명령어는 서버에서만 사용할 수 있습니다.",
                    ephemeral: true,
                });
                return;
            }

            try {
                await interaction.deferReply();

                // 유저 존재여부 확인
                if (await checkDiscordIdExists(interaction.user.id)) {
                    const target_user =
                        interaction.options.getUser("user") || interaction.user;

                    // 사용자 정보 불러오기
                    const user = await getUserByDiscordId(target_user.id);

                    // 사용자 정보가 없을 경우
                    if (!user) {
                        await interaction.editReply({
                            content: "등록된 사용자 정보가 없습니다.",
                            ephemeral: true,
                        });
                        return;
                    }

                    const dateInput = interaction.options.getString("date");
                    let targetDate;
                    //targetdate가 null이면
                    if (dateInput) {
                        //입력된 날짜가 new Date()로 변환 가능한지 확인
                        if (isNaN(new Date(`${dateInput}`))) {
                            await interaction.editReply({
                                content:
                                    "날짜 형식이 잘못되었습니다.(YYYY-MM-DD)",
                                ephemeral: true,
                            });
                            return;
                        }

                        try {
                            targetDate = new Date(`${dateInput}`);
                        } catch (error) {
                            console.error("날짜 변환 중 오류 발생:", error);
                            await interaction.editReply({
                                content: "날짜 변환 중 오류가 발생했습니다.",
                                ephemeral: true,
                            });
                            return;
                        }
                    } else {
                        targetDate = new Date();
                    }
                    targetDate.setHours(6, 30, 0, 0);
                    targetDate.setDate(targetDate.getDate() - 1);
                    while (targetDate.getDay() !== 1) {
                        targetDate.setDate(targetDate.getDate() - 1);
                    }

                    let records = "";
                    let strickCount = 0;
                    let notStrickCount = 0;
                    const userCount = (await getUsersBeforeDate(targetDate))
                        .length;

                    for (let i = 0; i < 7; i++) {
                        const year = targetDate.getFullYear();
                        const month = targetDate.getMonth() + 1; // getMonth()는 0부터 시작하므로 1을 더해줍니다.
                        let day = targetDate.getDate();
                        const formattedDate = `${year}-${String(month).padStart(
                            2,
                            "0"
                        )}-${String(day).padStart(2, "0")}`;

                        const createDate = new Date(user.create_date);
                        if (createDate.getHours() >= 6)
                            createDate.setDate(createDate.getDate() + 1);
                        createDate.setHours(6, 30, 0, 0);
                        const nowDate = new Date();
                        if (nowDate.getHours() < 6)
                            nowDate.setDate(nowDate.getDate() - 1);
                        nowDate.setHours(6, 30, 0, 0);

                        if (targetDate >= nowDate || targetDate <= createDate) {
                            records += `:grey_question: ${formattedDate}\n `;
                            targetDate.setDate(targetDate.getDate() + 1);
                            continue;
                        }

                        let user_problems;
                        try {
                            user_problems = await getProblemsSolvedByUserOnDate(
                                user.id,
                                targetDate
                            );
                        } catch (error) {
                            console.error(
                                "특정 날짜에 해결한 문제들을 불러오는 도중 오류가 발생했습니다:",
                                error
                            );
                        }

                        const filteredProblems = user_problems.filter(
                            (problemHolder) => problemHolder.strick
                        );

                        if (filteredProblems.length > 0) {
                            records += `:white_check_mark: ${formattedDate} [${filteredProblems.length}문제/${user_problems.length}문제]\n `;
                            strickCount++;
                        } else {
                            records += `:x: ${formattedDate} [${filteredProblems.length}문제/${user_problems.length}문제]\n `;
                            notStrickCount++;
                        }

                        targetDate.setDate(targetDate.getDate() + 1);
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0xadff2f)
                        .setTitle(`${user.handle}님의 스트릭 기록`)
                        .setFields([
                            {
                                name: `성공: ${strickCount}일, 실패: ${notStrickCount}일, 벌금 : ${
                                    notStrickCount === 0
                                        ? 0
                                        : Math.pow(2, notStrickCount) *
                                          100 *
                                          userCount
                                }원`,
                                value: records,
                                inline: false,
                            },
                        ])
                        .setFooter({
                            text: EmbedFooterText,
                            iconURL: EmbedFooterImageUrl,
                        });

                    await interaction.editReply({
                        embeds: [embed],
                    });
                } else {
                    await interaction.editReply({
                        content: "등록된 사용자 정보가 없습니다.",
                        ephemeral: true,
                    });
                    return;
                }
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: "스트릭 정보를 불러오는 도중 문제가 발생했습니다.",
                    ephemeral: true,
                });
                return;
            }
        } else if (commandName === "벌금") {
            if (!interaction.guild) {
                await interaction.reply({
                    content: "이 명령어는 서버에서만 사용할 수 있습니다.",
                    ephemeral: true,
                });
                return;
            }
            await interaction.deferReply();

            try {
                const dateInput = interaction.options.getString("date");
                let targetDate;
                //targetdate가 null이면
                if (dateInput) {
                    //입력된 날짜가 new Date()로 변환 가능한지 확인
                    if (isNaN(new Date(`${dateInput}`))) {
                        await interaction.editReply({
                            content: "날짜 형식이 잘못되었습니다.(YYYY-MM-DD)",
                            ephemeral: true,
                        });
                        return;
                    }

                    try {
                        targetDate = new Date(`${dateInput}`);
                    } catch (error) {
                        console.error("날짜 변환 중 오류 발생:", error);
                        await interaction.editReply({
                            content: "날짜 변환 중 오류가 발생했습니다.",
                            ephemeral: true,
                        });
                        return;
                    }
                } else {
                    targetDate = new Date();
                }

                targetDate.setHours(6, 30, 0, 0);
                targetDate.setDate(targetDate.getDate() - 1);
                while (targetDate.getDay() !== 1) {
                    targetDate.setDate(targetDate.getDate() - 1);
                }

                const users = await getUsersBeforeDate(targetDate);
                let records = "";
                let total = 0;
                let count = 0;
                for (const user of users) {
                    let notStrickCount = 0;
                    let repeatDate = new Date(targetDate);
                    for (let i = 0; i < 7; i++) {
                        const createDate = new Date(user.create_date);
                        if (createDate.getHours() >= 6)
                            createDate.setDate(createDate.getDate() + 1);
                        createDate.setHours(6, 30, 0, 0);
                        const nowDate = new Date();
                        if (nowDate.getHours() < 6)
                            nowDate.setDate(nowDate.getDate() - 1);
                        nowDate.setHours(6, 30, 0, 0);

                        if (repeatDate >= nowDate || repeatDate <= createDate) {
                            repeatDate.setDate(repeatDate.getDate() + 1);
                            continue;
                        }

                        let user_problems;
                        try {
                            user_problems = await getProblemsSolvedByUserOnDate(
                                user.id,
                                repeatDate
                            );
                        } catch (error) {
                            console.error(
                                "특정 날짜에 해결한 문제들을 불러오는 도중 오류가 발생했습니다:",
                                error
                            );
                        }

                        const filteredProblems = user_problems.filter(
                            (problemHolder) => problemHolder.strick
                        );

                        if (filteredProblems.length == 0) {
                            notStrickCount++;
                        }

                        repeatDate.setDate(repeatDate.getDate() + 1);
                    }

                    if (notStrickCount > 0) {
                        records += `:x: ${user.handle} - ${
                            Math.pow(2, notStrickCount) * 100 * users.length
                        }원\n`;
                        total +=
                            Math.pow(2, notStrickCount) * 100 * users.length;
                        count++;
                    } else {
                        records += `:white_check_mark: ${user.handle} - 0원\n`;
                    }
                }

                if (records === "") {
                    records = "벌금 대상이 없습니다.";
                }

                //시작날짜
                const startDate = formatDate(targetDate);

                //종료날짜
                targetDate.setDate(targetDate.getDate() + 6);
                const endDate = formatDate(targetDate);

                const embed = new EmbedBuilder()
                    .setColor(0xadff2f)
                    .setTitle(`${startDate} ~ ${endDate} 벌금`)
                    .setFields([
                        {
                            name: `인원 : ${count}명, 합계 : ${total}원`,
                            value: records,
                            inline: false,
                        },
                    ])
                    .setFooter({
                        text: EmbedFooterText,
                        iconURL: EmbedFooterImageUrl,
                    });

                await interaction.editReply({
                    embeds: [embed],
                });
            } catch (error) {
                console.error(error);
                await interaction.editReply({
                    content: "스트릭 정보를 불러오는 도중 문제가 발생했습니다.",
                    ephemeral: true,
                });
                return;
            }
        }
    } else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("registerModal")) {
            const bojHandle = interaction.fields.getTextInputValue("bojHandle");

            try {
                // 사용자 정보 불러오기
                const userData = await getSolvedUserData(bojHandle);

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
                    .setColor(0xff0000) //빨간색
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

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    try {
        // 첫 번째 드롭다운 처리
        if (interaction.customId.startsWith("toggleNotification")) {
            const selectedValue = interaction.values[0]; // 선택된 값

            if (selectedValue === "off") {
                // 알림 끄기 로직 실행

                const user = await getUserByDiscordId(interaction.user.id);
                updateUser(user.id, { notice_time: null });

                await interaction.update({
                    content: "DM 알림이 꺼졌습니다.",
                    components: [], // 기존 드롭다운 제거
                });
            } else if (selectedValue === "on") {
                // 시간 선택 드롭다운 표시
                const timeSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`timeSelect-${interaction.user.id}`) // 고유 ID
                    .setPlaceholder("시간을 선택하세요")
                    .addOptions(
                        [...Array(24).keys()].map((hour) => ({
                            label: `${hour}시 30분`,
                            value: `${hour}`,
                        }))
                    );

                const timeActionRow = new ActionRowBuilder().addComponents(
                    timeSelectMenu
                );

                await interaction.update({
                    content: "DM 알림 시간을 선택하세요:",
                    components: [timeActionRow],
                });
            }
        }

        // 두 번째 드롭다운 처리 (시간 선택)
        if (interaction.customId.startsWith("timeSelect")) {
            const selectedTime = interaction.values[0]; // 선택된 시간

            // 알림 켜기 로직 실행
            const user = await getUserByDiscordId(interaction.user.id);
            updateUser(user.id, { notice_time: parseInt(selectedTime) });

            await interaction.update({
                content: `DM 알림을 ${selectedTime}시 30분으로 설정하였습니다.`,
                components: [], // 기존 드롭다운 제거
            });

            // 여기서 알림 예약 작업 추가
            // 예: setTimeout(() => sendNotification(interaction.user, selectedTime), delay);
        }
    } catch (error) {
        console.error("드롭다운 처리 중 오류 발생:", error);
        await interaction.update({
            content: "알림 설정 중 오류가 발생했습니다",
            components: [], // 기존 드롭다운 제거
        });
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
