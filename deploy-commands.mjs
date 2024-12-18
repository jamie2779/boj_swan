import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { SlashCommandBuilder } from "@discordjs/builders";
import dotenv from "dotenv";

dotenv.config();

const commands = [
    new SlashCommandBuilder()
        .setName("등록")
        .setDescription("BOJ Handle을 등록합니다."),
    new SlashCommandBuilder()
        .setName("정보")
        .setDescription("본인 / 특정 유저의 정보를 확인합니다.")
        .addMentionableOption((option) =>
            option.setName("user").setDescription("유저를 선택하세요.")
        ),
    new SlashCommandBuilder()
        .setName("벌금")
        .setDescription("모든 유저의 일주일 벌금을 확인합니다.")
        .addStringOption((option) =>
            option.setName("date").setDescription("날짜를 입력하세요.")
        ),
    new SlashCommandBuilder()
        .setName("강제갱신")
        .setDescription(
            "유저 정보와 문제 정보를 강제로 갱신합니다 (쿨타임 1시간)"
        ),
    new SlashCommandBuilder()
        .setName("스트릭")
        .setDescription(
            "특정 날짜의 스트릭을 채웠는지 확인합니다. (쿨타임 5분)"
        )
        .addMentionableOption((option) =>
            option.setName("user").setDescription("유저를 선택하세요.")
        )
        .addStringOption((option) =>
            option.setName("date").setDescription("날짜를 입력하세요.")
        ),
    new SlashCommandBuilder()
        .setName("기록")
        .setDescription("특정 유저의 일주일 스트릭 기록을 봅니다.")
        .addMentionableOption((option) =>
            option.setName("user").setDescription("유저를 선택하세요.")
        )
        .addStringOption((option) =>
            option.setName("date").setDescription("날짜를 입력하세요.")
        ),
    new SlashCommandBuilder()
        .setName("알림")
        .setDescription("DM 알림을 설정합니다."),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_BOT_TOKEN
);

(async () => {
    try {
        console.log("슬래시 명령어를 서버에 등록 중입니다.");

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log("슬래시 명령어 등록 완료.");
    } catch (error) {
        console.error(error);
    }
})();
