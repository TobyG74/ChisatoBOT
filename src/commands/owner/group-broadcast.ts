import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { FileUtils } from "../../utils/core";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";
import type { ConfigCommands } from "../../types/structure/commands.js";

const REPO_URL: string = (() => {
    try {
        const pkgPath = resolve(process.cwd(), "package.json");
        if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
            const home = typeof pkg?.homepage === "string"
                ? pkg.homepage.trim()
                : "";
            if (home) return home.replace(/#.*$/, "");  
        }
    } catch {  }
    return "https://github.com/TobyG74/ChisatoBOT";
})();

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
    async run({ Chisato, query, from, message, prefix }) {
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

        const bodyText =
            `${query}\n\n` +
            `_Broadcast by ${message.pushName}_`;

        const ownerCmd = `${prefix ?? "."}owner`;

        (async () => {
            for (const group of groups) {
                await FileUtils.sleep(1000);
                try {
                    const builder = new TemplateBuilder.Native(Chisato);
                    builder
                        .mainBody(bodyText)
                        .mainFooter(`ChisatoBOT - ${new Date().toLocaleDateString()}`);

                    if (isImage && buffer) {
                        builder.mainHeader("*「 GROUP BROADCAST 」*", buffer);
                    } else {
                        builder.mainHeader("*「 GROUP BROADCAST 」*");
                    }

                    builder.buttons(
                        builder.button.url({
                            display: "🌐 GitHub Repository",
                            url: REPO_URL,
                        }),
                        builder.button.reply({
                            display: "👤 Contact Owner",
                            id: ownerCmd,
                        })
                    );

                    const msg = await builder.render();
                    await Chisato.relayMessage(group, msg.message, {
                        messageId: msg.key.id,
                    });
                } catch {
                    // skip groups that fail (banned, left, missing templates, etc.)
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
