import type { ConfigCommands } from "../../types/structure/commands";
import { messages } from "../../libs/werewolf/i18n";
import { getGame } from "../../libs/werewolf";

import { handleStart, handleJoin, handleLeave, handlePlayers, handleBegin, handleLang, handleHelp } from "../../libs/werewolf/handlers/lobby";
import { handleKill, handleCheck, handleSave, handlePoison, handleHeal, handleProtect, handleShoot } from "../../libs/werewolf/handlers/night";
import { handleVote, handleStatus, handleEnd } from "../../libs/werewolf/handlers/day";

type Ctx = Parameters<ConfigCommands["run"]>[0];

const HANDLERS: Record<string, (ctx: Ctx) => Promise<void>> = {
    start: handleStart,
    join: handleJoin,
    leave: handleLeave,
    players: handlePlayers,
    begin: handleBegin,
    lang: handleLang,
    kill: handleKill,
    check: handleCheck,
    save: handleSave,
    poison: handlePoison,
    heal: handleHeal,
    protect: handleProtect,
    shoot: handleShoot,
    vote: handleVote,
    status: handleStatus,
    end: handleEnd,
    help: handleHelp,
};

export default {
    name: "werewolf",
    alias: ["ww", "werwolf"],
    category: "games",
    description: "Werewolf / Mafia game for groups",
    async run(ctx) {
        const { Chisato, from, message, args } = ctx;
        const sub = (args?.[0] ?? "help").toLowerCase();
        const handler = HANDLERS[sub];

        if (!handler) {
            const game = getGame(from);
            const m = messages(game?.lang ?? "id");
            await Chisato.sendText(from, m.unknownSub(sub), message);
            return;
        }

        return handler(ctx);
    },
} satisfies ConfigCommands;
