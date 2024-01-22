import type { ConfigCommands } from "../../types/commands";
import os from "os";

const formatUsage = (bytes: number) => {
    return `${Math.round((bytes / 1024 / 1024) * 100) / 100}`;
};

export default <ConfigCommands>{
    name: "status",
    alias: ["memory", "cpu"],
    category: "misc",
    description: "View the memory, CPU, etc. status of the bot",
    isOwner: true,
    async run({ Chisato, from, message, botName }) {
        const memory = process.memoryUsage();
        const totalmemory = Math.round(require("os").totalmem / 1024 / 1024);
        let caption =
            "┏━━「 𓆩 𝚮ɪᴅᴅᴇɴ 𝐅ɪɴᴅᴇʀ ⁣𓆪 」\n┃\n" +
            `┣━━━「 *MEMORY USAGE* 」━━━\n┃\n` +
            `┣ Total Memory : ${formatUsage(memory.rss)} / ${totalmemory} MB\n` +
            `┣ Heap Total : ${formatUsage(memory.heapTotal)} MB\n` +
            `┣ Heap Used : ${formatUsage(memory.heapUsed)} MB\n` +
            `┣ External : ${formatUsage(memory.external)} MB\n` +
            `┣ Array Buffers : ${formatUsage(memory.arrayBuffers)} MB\n┃\n` +
            `┣━━━「 *CPUS* 」━━━\n┃\n`;
        for (let cpu of os.cpus()) {
            caption +=
                `┣ Model : ${cpu.model}\n` +
                `┣ User : ${formatUsage(cpu.times.user)} MB\n` +
                `┣ System : ${formatUsage(cpu.times.user)} MB\n` +
                `┣ Idle : ${formatUsage(cpu.times.idle)} MB\n┃\n`;
        }
        caption +=
            `┣━━━「 *NODE* 」━━━\n┃\n` +
            `┣ NodeJS : ${process.versions.node}\n` +
            `┣ NPM : ${process.versions.acorn}\n┃\n` +
            `┣━━━「 *PLATFORM* 」━━━\n┃\n` +
            `┣ Platform : ${process.platform}\n` +
            `┣ Arch : ${process.arch}\n┃\n` +
            `┗━━「 *${botName}* 」`;
        await Chisato.sendText(from, caption, message);
    },
};
