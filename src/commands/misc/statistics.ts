import type { ConfigCommands } from "../../types/structure/commands";

/** Database */
import { Group, User } from "../../libs/database";

export default {
    name: "stats",
    alias: ["statistics", "statistic", "stat"],
    category: "misc",
    description: "View the count from the database",
    async run({ Chisato, from, message }) {
        const group = new Group();
        const user = new User();

        const caption =
            `「 *TOTAL DATABASE* 」\n\n` + `• Group : ${await group.size()}\n` + `• User : ${await user.size()}\n`;

        await Chisato.sendText(from, caption, message);
    },
} satisfies ConfigCommands;