import type { WACallEvent } from "baileys";
import { Client } from "../../../libs";
import { configService } from "../../../core/config";
import { logger } from "../../../core/logger";
import { resolveToPnJid } from "../../../utils/jid-resolver";
import moment from "moment-timezone";

export class AntiCallHandler {
    async handle(Chisato: Client, message: WACallEvent): Promise<void> {
        try {
            const config = configService.getConfig();
            const { from, id, status, isVideo, isGroup } = message;

            if (isGroup) return;

            if (config.call.status !== "reject" && config.call.status !== "block") return;

            if (status !== "offer") return;

            const callerPn = await resolveToPnJid(Chisato, from);
            const callerNumber = callerPn.split("@")[0];
            const isOwner = config.ownerNumber.includes(callerNumber);
            if (isOwner) return;

            const time = moment().format("HH:mm:ss DD/MM");
            const callType = isVideo ? "Video" : "Voice";

            try {
                await Chisato.rejectCall(id, from);
                logger.info(
                    `${time} | ${callType} call from ${callerNumber} has been rejected!`
                );
            } catch (error) {
                logger.error(
                    `Failed to reject call from ${callerNumber}: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }

            const targetJid = callerPn || from;

            if (config.call.status === "block") {
                try {
                    await Chisato.sendText(
                        targetJid,
                        "*「 ANTI CALL 」*\n\nSorry, I can't take phone calls! I will block you. To open the block please contact the Owner!"
                    );
                } catch { /* ignore — caller may be unreachable */ }

                if (config.ownerNumber.length) {
                    try {
                        await Chisato.sendContact(targetJid, config.ownerNumber);
                    } catch { /* ignore */ }
                }

                try {
                    await Chisato.updateBlockStatus(targetJid, "block");
                    logger.info(
                        `${time} | ${callType} caller ${callerNumber} has been blocked!`
                    );
                } catch (error) {
                    logger.error(
                        `Failed to block caller ${callerNumber}: ${
                            error instanceof Error ? error.message : String(error)
                        }`
                    );
                }
            } else {
                try {
                    await Chisato.sendText(
                        targetJid,
                        "*「 ANTI CALL 」*\n\nSorry, I can't take phone calls!"
                    );
                } catch { /* ignore — caller may be unreachable */ }
            }
        } catch (error) {
            logger.error(
                `Anti-call handler error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}
