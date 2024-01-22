import fs from "fs";
import clc from "cli-color";
import { Cron } from "croner";
import { Database } from "../libs";

const config: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

export const resetUserLimit = new Cron("0 0 0 * * *", { timezone: config.timezone }, async () => {
    console.log(
        clc.green.bold("[ ") + clc.white.bold("CRON") + clc.green.bold(" ] ") + clc.yellow.bold("Reset user limit...")
    );
    // Reset user limit
    await Promise.all([
        Database.user.updateMany({
            where: {
                userId: {
                    contains: "@s.whatsapp.net",
                },
                role: {
                    in: ["free"],
                },
            },
            data: {
                limit: config.limit.command,
            },
        }),
    ]);
});
