import type { ConfigCommands } from "../../types/structure/commands";
import { createTetrisHtml } from "../../utils/games/tetris/html";

export default {
    name: "tetris",
    alias: ["tetromino"],
    category: "games",
    description: "Play Tetris with touch or keyboard controls in an HTML card",
    cooldown: 5,
    async run({ Chisato, from, message }) {
        await Chisato.sendReaction(from, "⏳", message.key);
        try {
            await Chisato.sendRichHtml(from, { id: "tetris", title: "Tetris • ChisatoBOT", html: createTetrisHtml() });
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error) {
            Chisato.logger.error("Failed to send Tetris:", error);
            await Chisato.sendReaction(from, "❌", message.key);
            await Chisato.sendText(from, "Tetris gagal dikirim. Coba lagi dengan perintah tetris.", message);
        }
    }
} satisfies ConfigCommands;
