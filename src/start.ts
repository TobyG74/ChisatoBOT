import { Client } from "./auth/client";
import Pino from "pino";

(async () => {
    new Client().connect({
        session: "multi",
        printQRInTerminal: true,
        syncFullHistory: false,
        shouldSyncHistoryMessage: false,
        browser: ["ChisatoBOT", "Safari", "3.0.0"],
        logger: Pino({ level: "silent" }).child({ level: "silent" }),
    });
})();
