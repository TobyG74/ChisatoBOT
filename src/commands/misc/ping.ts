import type { ConfigCommands } from "../../types/commands";
import moment from "moment-timezone";

const ping = function (timestamp: number, now: number) {
    return moment.duration(now - Number(moment(timestamp * 1000))).asSeconds();
};

export default <ConfigCommands>{
    name: "ping",
    alias: ["speed"],
    category: "misc",
    description: "See the ping of bot",
    async run({ Chisato, from, message }) {
        const text = `Ping : ${ping(message.messageTimestamp, Date.now())} seconds`;
        await Chisato.sendText(from, text, message, {
            contextInfo: {
                expiration: 0,
            },
        });
    },
};
