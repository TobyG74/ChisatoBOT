import type { WACallEvent } from "@whiskeysockets/baileys";
import { Client } from "../../../libs";
import { configService } from "../../../core/config";
import { logger } from "../../../core/logger";
import moment from "moment-timezone";

export class AntiCallHandler {
    async handle(Chisato: Client, message: WACallEvent): Promise<void> {
        try {
            const config = configService.getConfig();
            const { from, id, status, isVideo, isGroup } = message;
            const isOwner = config.ownerNumber.includes(from.split("@")[0]);
            const time = moment().format("HH:mm:ss DD/MM");

            if (isGroup || isOwner) return;

            if (status === "offer") {
                await this.handleCallOffer(
                    Chisato,
                    from,
                    id,
                    isVideo,
                    time,
                    config
                );
            }
        } catch (error) {
            logger.error(
                `Anti-call handler error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    private async handleCallOffer(
        Chisato: Client,
        from: string,
        callId: string,
        isVideo: boolean,
        time: string,
        config: any
    ): Promise<void> {
        const callType = isVideo ? "Video" : "Voice";

        if (config.call.status === "block") {
            await Chisato.sendText(
                from,
                "*「 ANTI CALL 」*\n\nSorry, I can't take phone calls! I will block you. To open the block please contact the Owner!"
            );

            await Chisato.rejectCall(callId, from);
            await Chisato.sendContact(from, config.ownerNumber);
            await Chisato.updateBlockStatus(from, "block");

            logger.info(
                `${time} | ${callType} call from ${from} has been rejected & blocked!`
            );
        } else if (config.call.status === "reject") {
            await Chisato.sendText(
                from,
                "*「 ANTI CALL 」*\n\nSorry, I can't take phone calls!"
            );

            await Chisato.rejectCall(callId, from);

            logger.info(
                `${time} | ${callType} call from ${from} has been rejected!`
            );
        }
    }
}
