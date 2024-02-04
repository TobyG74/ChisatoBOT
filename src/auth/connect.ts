import { Client } from "../libs/client/client";
import Pino from "pino";
import { serialize } from "../libs";
import { antiCall, groupUpdate, messageUpsert } from "../handlers";

(async () => {
    const Chisato = new Client({
        session: "multi",
        printQRInTerminal: true,
        syncFullHistory: false,
        browser: ["ChisatoBOT", "Safari", "3.0.0"],
        logger: Pino({ level: "silent" }).child({ level: "silent" }),
    });

    await Chisato.connect();

    Chisato.on("messages.upsert", async (message) => {
        serialize
            .message(Chisato, message)
            .then((serialized) => {
                messageUpsert(Chisato, serialized);
            })
            .catch(() => void 0);
    });

    Chisato.on("group.update", async (update) => {
        serialize
            .group(update)
            .then((serialized) => {
                groupUpdate(Chisato, serialized);
            })
            .catch(() => void 0);
    });

    Chisato.on("call", async (call) => {
        antiCall(Chisato, call);
    });
})();
