import moment from "moment-timezone";
import fs from "fs";
import { Chisato } from "../../types/client";
import { CallSerialize } from "../../types/serialize";

export const antiCall = async (Chisato: Chisato, message: CallSerialize) => {
    const { ownerNumber, call }: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
    const { chatId, from, id, date, offline, status, isVideo, isGroup } = message;
    const isOwner = ownerNumber.includes(from.split("@")[0]);
    const time = moment().format("HH:mm:ss DD/MM");
    if (!isGroup && !isOwner) {
        if (status === "offer") {
            if (call.status === "block") {
                await Chisato.sendText(
                    from,
                    "*「 ANTI CALL 」*\n\nSorry, I can't take phone calls! I will block you. To open the block please contact the Owner!"
                );
                Chisato.rejectCall(id, from);
                await Chisato.sendContact(from, ownerNumber);
                Chisato.updateBlockStatus(from, "block");
                Chisato.log(
                    "info",
                    `${time} | Video : ${isVideo ? "Yes" : "No"}Call from ${from} has been rejected & blocked!`
                );
            } else if (call.status === "reject") {
                await Chisato.sendText(from, "*「 ANTI CALL 」*\n\nSorry, I can't take phone calls!");
                Chisato.rejectCall(id, from);
                Chisato.log("info", `${time} | Video : ${isVideo ? "Yes" : "No"} Call from ${from} has been rejected!`);
            }
        }
    }
};
