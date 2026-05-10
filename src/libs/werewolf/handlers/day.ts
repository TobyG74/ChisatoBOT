import type { ConfigCommands } from "../../../types/structure/commands";
import {
    alivePlayers,
    endGame,
    getGame,
    resolveGame,
    submitVote,
    ROLE_INFO,
} from "../index";
import { messages } from "../i18n";
import { fmt, resolveVotePhase, startNightPhase, afterDayElimination } from "./flow";

type Ctx = Parameters<ConfigCommands["run"]>[0];

// /ww vote
export async function handleVote(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, args, message, pushName } = ctx;

    const game = resolveGame(from, sender);
    if (!game || game.phase !== "day") {
        if (game) await Chisato.sendText(from, messages(game.lang).wrongPhaseDay, message);
        return;
    }

    const m = messages(game.lang);
    const voter = game.players.get(sender);
    if (!voter?.isAlive) {
        await Chisato.sendText(from, m.voteDeadPlayer, message);
        return;
    }

    const alive = alivePlayers(game);
    const raw = args[1];
    const idx = parseInt(raw ?? "", 10) - 1;

    let target = alive[idx];
    if (!target && message?.mentions?.length) {
        target = alive.find((p) => p.jid === message.mentions[0]) ?? alive[idx];
    }
    if (!target || !target.isAlive) {
        await Chisato.sendText(from, m.invalidTarget, message);
        return;
    }
    if (target.jid === sender) {
        await Chisato.sendText(from, m.voteSelf, message);
        return;
    }

    const isMayor = voter.role === "mayor";
    submitVote(game, sender, target.jid);

    const voted = [...game.dayVotes.values()];
    const total = alive.length;
    const name = pushName || fmt(sender);

    await Chisato.sendText(
        from,
        m.voteOk(name, fmt(target.jid), isMayor ? m.mayorNote : "", voted.length, total),
        message,
        { mentions: [sender, target.jid] }
    );

    // Auto-resolve when everyone has voted
    if (voted.length >= total) {
        await resolveVotePhase(ctx, game);
    }
}

// /ww status 
export async function handleStatus(ctx: Ctx): Promise<void> {
    const { Chisato, from, message } = ctx;

    const game = getGame(from);
    if (!game) {
        await Chisato.sendText(from, messages("id").noActiveGame, message);
        return;
    }

    const m = messages(game.lang);
    const phaseLabel = m.phaseNames[game.phase] ?? game.phase;
    let text = m.statusHeader(phaseLabel, game.round);

    const alive = alivePlayers(game);
    text += m.statusAlive(alive.length);
    text += alive.length ? alive.map((p) => `• ${fmt(p.jid)}`).join("\n") : m.statusNone;

    const dead = [...game.players.values()].filter((p) => !p.isAlive);
    if (dead.length) {
        text += m.statusDead(dead.length);
        text += dead
            .map((p) => `• ${fmt(p.jid)} — ${ROLE_INFO[p.role].emoji} ${ROLE_INFO[p.role].title}`)
            .join("\n");
    }

    await Chisato.sendText(from, text, message, {
        mentions: [...game.players.keys()],
    });
}

// /ww end
export async function handleEnd(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, message, isOwner, pushName } = ctx;

    const game = getGame(from);
    if (!game) {
        await Chisato.sendText(from, messages("id").noActiveGame, message);
        return;
    }

    const m = messages(game.lang);

    if (game.hostId !== sender && !isOwner) {
        await Chisato.sendText(from, m.notHost, message);
        return;
    }

    if (game.timer) clearTimeout(game.timer);
    if (game.voteTimer) clearTimeout(game.voteTimer);

    endGame(from);

    const name = pushName || fmt(sender);
    await Chisato.sendText(from, m.gameEndedBy(name), message, { mentions: [sender] });
}
