import { FileUtils } from "../../utils/core";
import type { ConfigCommands } from "../../types/structure/commands.js";

export default {
    name: "groupbc",
    alias: ["gcbc", "bcgc"],
    usage: "[text]",
    category: "owner",
    description: "Sending Broadcast To All Groups",
    isOwner: true,
    example: `*「 GROUP BROADCAST 」*

🔗 Send Broadcast to all groups

📝 *Usage:*
{prefix}{command.name} [text]

💡 *Example:*
{prefix}{command.name} Hello everyone! This is a group broadcast message!`,
    async run({ Chisato, query, from, message }) {
        const groups = Object.entries(
            await Chisato.groupFetchAllParticipating() as Record<string, any>
        )
            .slice(0)
            .map((entry) => entry[1])
            .filter((v) => !v.isCommunity && !v.isCommunityAnnounce)
            .map((v) => v.id);

        const isImage =
            message?.type === "imageMessage" ||
            message.quoted?.type === "imageMessage";

        let buffer: Buffer | null = null;
        if (isImage) {
            buffer = message.quoted !== null
                ? await message.quoted.download()
                : await message.download();
        }

        await Chisato.sendText(
            from,
            `Sending Broadcast to ${groups.length} Group!`,
            message
        );

        (async () => {
            for (const group of groups) {
                await FileUtils.sleep(1000);
                const str =
                    `*「 GROUP BROADCAST 」*\n\n` +
                    `${query}\n\n` +
                    `_Broadcast by ${message.pushName}_`;
                try {
                    if (isImage && buffer) {
                        await Chisato.sendImage(group, buffer, str, null, {
                            contextInfo: {
                                forwardingScore: groups.length,
                                isForwarded: true,
                            },
                        });
                    } else {
                        await Chisato.sendText(group, str, null, {
                            contextInfo: {
                                forwardingScore: groups.length,
                                isForwarded: true,
                            },
                        });
                    }
                } catch {
                    // skip groups that fail (banned, left, etc.)
                }
            }
            await Chisato.sendText(
                from,
                `Successfully Sending Broadcast to ${groups.length} Group!`,
                message
            );
        })().catch(() => {});
    },
} satisfies ConfigCommands;
