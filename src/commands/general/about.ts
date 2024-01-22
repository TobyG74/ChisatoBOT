import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "about",
    alias: ["infobot", "sc", "base"],
    category: "general",
    description: "See a Bots Information",
    async run({ Chisato, from, message }) {
        const caption =
            "*「 ABOUT 」*\n\n" +
            "• Creator : Tobz\n" +
            "• Team :  𓆩 𝚮ɪᴅᴅᴇɴ 𝐅ɪɴᴅᴇʀ ⁣𓆪 \n" +
            "• Github :\nhttps://github.com/TobyG74\n" +
            "• Repostitory :\nhttps://github.com/TobyG74/ChisatoBOT\n" +
            "• Instagram :\nhttps://instagram.com/ini.tobz\n\n" +
            "*「 MY TEAM 」*\n\n" +
            "• Arugaz\nhttps://github.com/arugaz\n" +
            "• Nugraizy\nhttps://github.com/nugraizy\n" +
            "• ctOS\nhttps://github.com/alphanum404\n";
        await Chisato.sendText(from, caption, message);
    },
};
