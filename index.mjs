import {Client, Intents} from "discord.js";
import {registerCommands} from "./deploy-commands.mjs";
import dotenv from 'dotenv'

dotenv.config({path: '.env'});
const client = new Client({intents: [Intents.FLAGS.GUILDS]});

// Slash Command 추가
registerCommands(process.env.DISCORD_BOT_TOKEN, process.env.CLIENT_ID, process.env.TO_REGISTER_GUILD);

// 메시지를 받으면 호출되는 함수
client.on('interactionCreate', async interaction => {
    // Original: https://discordjs.guide/interactions/replying-to-slash-commands.html#receiving-interactions
    if (!interaction.isCommand()) return;

    if (interaction.commandName === '안녕하세요') {
        await interaction.reply('인사 잘한다~');
    }
});

client.login(process.env.DISCORD_BOT_TOKEN).then(function () {
    console.log("LOGIN SUCCESS.");
});