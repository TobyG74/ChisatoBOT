import { sleep } from "../../libs";
import { ConfigCommands } from "../../types/commands.js";

export default <ConfigCommands>{
    name: "groupbc",
    alias: ["gcbc", "bcgc"],
    usage: "<text>",
    category: "owner",
    description: "Sending Broadcast To All Groups",
    isOwner: true,
    example: `
*With Text or Image*
• /groupbc Hello Everyone!`,
    async run({ Chisato, query, from, message }) {
        let buffer: Buffer | null;
        const groups = Object.entries(await Chisato.groupFetchAllParticipating())
            .slice(0)
            .map((entry) => entry[1])
            .filter((v) => !v.isCommunity && !v.isCommunityAnnounce)
            .map((v) => v.id);
        if (message?.type === "imageMessage" || message.quoted?.type === "imageMessage") {
            buffer = message.quoted !== null ? await message.quoted.download() : await message.download();
            Chisato.sendText(from, `Sending Broadcast to ${groups.length} Group!`, message);
            for (let group of groups) {
                await sleep(1000);
                const str = `*「 GROUP BROADCAST 」*\n\n` + `${query}\n\n` + `_Broadcast by ${message.pushName}_`;
                await Chisato.sendImage(group, buffer, str, null, {
                    contextInfo: {
                        forwardingScore: groups.length,
                        isForwarded: true,
                    },
                });
            }
            Chisato.sendText(from, `Successfully Sending Broadcast to ${groups.length} Group!`, message);
        } else {
            Chisato.sendText(from, `Sending Broadcast to ${groups.length} Group!`, message);
            for (let group of groups) {
                await sleep(1000);
                const str = `*「 GROUP BROADCAST 」*\n\n` + `${query}\n\n` + `_Broadcast by ${message.pushName}_`;
                Chisato.sendText(group, str, null, {
                    contextInfo: { forwardingScore: groups.length, isForwarded: true },
                });
            }
            Chisato.sendText(from, `Successfully Sending Broadcast to ${groups.length} Group!`, message);
        }
    },
};
