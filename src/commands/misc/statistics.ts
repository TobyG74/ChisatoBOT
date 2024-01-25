import type { ConfigCommands } from "../../types/commands";
import path from "path";
import fs from "fs";

/** Database */
import { Group, User, GroupSetting } from "../../libs/database";

export default <ConfigCommands>{
    name: "stats",
    alias: ["statistics", "statistic", "stat"],
    category: "misc",
    description: "View the count from the database",
    async run({ Chisato, from, message }) {
        const group = new Group();
        const groupSetting = new GroupSetting();
        const user = new User();
        const filepath = path.join(__dirname, "../../..", `temp`);
        const files = fs.readdirSync(filepath);

        const caption =
            `「 *TOTAL DATABASE* 」\n\n` +
            `• Group : ${await group.size()}\n` +
            `• Group Setting : ${await groupSetting.size()}\n` +
            `• User : ${await user.size()}\n` +
            `• AI User : ${files.length}\n`;

        await Chisato.sendText(from, caption, message);
    },
};
