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

// How many groups between progress updates sent to the owner.
const PROGRESS_INTERVAL = 25;

// Light delay between sends. Baileys' per-bot signal-store mutex already
// serialises every outgoing message, so this is just an extra cushion against
// WhatsApp's anti-flood, not the primary throttle.
const PER_SEND_DELAY_MS = 350;

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
    async run({ Chisato, query, command, from, message, prefix }) {
        const groupIds = Object.values(
            (await Chisato.groupFetchAllParticipating())
        ).filter((v: any) => !v.isCommunity && !v.isCommunityAnnouncement).map((v: any) => v.id);

        if (!groupIds.length) {
            await Chisato.sendText(
                from,
                "❌ Bot is not currently in any group.",
                message
            );
            return;
        }

        const isImage =
            message?.type === "imageMessage" ||
            message.quoted?.type === "imageMessage";

        let buffer: Buffer | null = null;
        if (isImage) {
            buffer =
                message.quoted !== null
                    ? await message.quoted.download()
                    : await message.download();
        }

        const bodyText = `${query}\n\n_Broadcast by ${message.pushName}_`;
        const ownerCmd = `${prefix ?? "."}owner`;

        let renderedContent: any;
        try {
            const builder = new TemplateBuilder.Native(Chisato);
            builder
                .mainBody(bodyText)
                .mainFooter(
                    `ChisatoBOT - ${new Date().toLocaleDateString()}`
                );

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

            const rendered = await builder.render();
            renderedContent = rendered.message;
        } catch (err) {
            Chisato.logger.error(
                command.name,
                `Failed to prepare broadcast template: ${
                    err instanceof Error ? err.message : String(err)
                }`
            );
            await Chisato.sendText(
                from,
                `❌ Failed to prepare broadcast template:\n${
                    err instanceof Error ? err.message : String(err)
                }`,
                message
            );
            return;
        }

        await Chisato.sendText(
            from,
            `📡 Sending broadcast to ${groupIds.length} group(s)...`,
            message
        );

        (async () => {
            const startedAt = Date.now();
            let success = 0;
            let failed = 0;

            for (let i = 0; i < groupIds.length; i++) {
                const groupId = groupIds[i];
                try {
                    await Chisato.relayMessage(groupId, renderedContent, {});
                    success++;
                } catch (err) {
                    failed++;
                    Chisato.logger.error(
                        command.name,
                        `Failed to send to ${groupId}: ${
                            err instanceof Error ? err.message : String(err)
                        }`
                    );
                }

                if (i + 1 < groupIds.length) {
                    await FileUtils.sleep(PER_SEND_DELAY_MS);
                }

                if (
                    (i + 1) % PROGRESS_INTERVAL === 0 &&
                    i + 1 < groupIds.length
                ) {
                    Chisato.sendText(
                        from,
                        `📡 Progress: ${i + 1}/${groupIds.length} ` +
                            `(✅ ${success} / ❌ ${failed})`,
                        message
                    ).catch((err) =>
                        Chisato.logger.error(
                            command.name,
                            `Failed to send progress update: ${
                                err instanceof Error
                                    ? err.message
                                    : String(err)
                            }`
                        )
                    );
                }
            }

            const elapsed = Math.round((Date.now() - startedAt) / 1000);
            const summary =
                `✅ *Group Broadcast Done!*\n\n` +
                `• Total   : ${groupIds.length}\n` +
                `• Success : ${success}\n` +
                `• Failed  : ${failed}\n` +
                `• Elapsed : ${elapsed}s`;

            try {
                await Chisato.sendText(from, summary, message);
            } catch (err) {
                Chisato.logger.error(
                    command.name,
                    `Failed to send completion message: ${
                        err instanceof Error ? err.message : String(err)
                    }`
                );
                try {
                    await Chisato.sendText(from, summary);
                } catch (err2) {
                    Chisato.logger.error(
                        command.name,
                        `Retry of completion message also failed: ${
                            err2 instanceof Error ? err2.message : String(err2)
                        }`
                    );
                }
            }
        })().catch((err) => {
            Chisato.logger.error(
                command.name,
                `Broadcast loop crashed: ${
                    err instanceof Error ? err.message : String(err)
                }`
            );
            Chisato.sendText(
                from,
                `❌ Broadcast crashed: ${
                    err instanceof Error ? err.message : String(err)
                }`,
                message
            ).catch(() => {});
        });
    },
} satisfies ConfigCommands;
