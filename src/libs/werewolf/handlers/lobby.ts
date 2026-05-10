import type { ConfigCommands } from "../../../types/structure/commands";
import fs from "fs";
import path from "path";
import {
    createGame,
    joinGame,
    leaveGame,
    getGame,
    assignRoles,
    alivePlayers,
    aliveWolves,
    getRoleImageBuffer,
    hasActiveGame,
    isInAnyGame,
    setLangVote,
    resolveLang,
    ROLE_INFO,
} from "../index";
import type { Lang } from "../index";
import { messages } from "../i18n";
import { fmt, startNightPhase } from "./flow";

type Ctx = Parameters<ConfigCommands["run"]>[0];

// /ww start

export async function handleStart(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, message, pushName } = ctx;

    if (!from.endsWith("@g.us")) {
        await Chisato.sendText(from, messages("id").onlyGroup, message);
        return;
    }
    if (hasActiveGame(from)) {
        // Use existing game lang if somehow already exists, else default id
        await Chisato.sendText(from, messages("id").gameAlreadyActive, message);
        return;
    }
    if (isInAnyGame(sender)) {
        await Chisato.sendText(from, messages("id").alreadyInOtherGame, message);
        return;
    }

    createGame(from, sender, pushName || sender.split("@")[0]);

    const m = messages("id"); // new lobby always shows ID first (votes determine final)
    await Chisato.sendText(
        from,
        m.gameCreated(fmt(sender)),
        message,
        { mentions: [sender] }
    );
}

// /ww lang

export async function handleLang(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, args, message, pushName } = ctx;

    const game = getGame(from);
    if (!game || game.phase !== "lobby") {
        // use neutral lang
        await Chisato.sendText(from, messages("id").langNotInLobby, message);
        return;
    }
    if (!game.players.has(sender)) {
        await Chisato.sendText(from, messages(game.lang).joinNoGame, message);
        return;
    }

    const raw = (args[1] ?? "").toLowerCase() as Lang;
    if (raw !== "en" && raw !== "id") {
        await Chisato.sendText(from, messages(game.lang).langInvalid, message);
        return;
    }

    setLangVote(game, sender, raw);

    const en = [...game.langVotes.values()].filter((v) => v === "en").length;
    const id = [...game.langVotes.values()].filter((v) => v === "id").length;
    const name = pushName || fmt(sender);

    await Chisato.sendText(
        from,
        messages(game.lang).langVoteOk(name, raw, en, id),
        message,
        { mentions: [sender] }
    );
}

// /ww join

export async function handleJoin(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, message, pushName } = ctx;

    if (!from.endsWith("@g.us")) {
        await Chisato.sendText(from, messages("id").onlyGroup, message);
        return;
    }

    const game = getGame(from);
    const lang = game?.lang ?? "id";
    const m = messages(lang);

    const result = joinGame(from, sender, pushName || sender.split("@")[0]);

    const replies: Record<typeof result, string> = {
        ok: m.joinOk(fmt(sender)),
        no_game: m.joinNoGame,
        already_joined: m.joinAlreadyJoined,
        game_started: m.joinStarted,
        in_other_game: m.joinOtherGame,
    };

    await Chisato.sendText(
        from,
        replies[result],
        message,
        result === "ok" ? { mentions: [sender] } : undefined
    );
}

// /ww leave

export async function handleLeave(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, message } = ctx;

    if (!from.endsWith("@g.us")) return;

    const game = getGame(from);
    const m = messages(game?.lang ?? "id");

    const result = leaveGame(from, sender);

    if (result === "ok") {
        await Chisato.sendText(from, m.leaveOk(fmt(sender)), message, { mentions: [sender] });
    } else if (result === "game_started") {
        await Chisato.sendText(from, m.leaveStarted, message);
    } else {
        await Chisato.sendText(from, m.leaveNotIn, message);
    }
}

// /ww players

export async function handlePlayers(ctx: Ctx): Promise<void> {
    const { Chisato, from, message } = ctx;

    const game = getGame(from);
    if (!game) {
        await Chisato.sendText(from, messages("id").noActiveGame, message);
        return;
    }

    const m = messages(game.lang);
    const list = [...game.players.values()]
        .map((p, i) => `${i + 1}. ${fmt(p.jid)}${p.isAlive ? "" : " 💀"}`)
        .join("\n");

    await Chisato.sendText(
        from,
        `${m.playersHeader(game.players.size)}\n${list}`,
        message,
        { mentions: [...game.players.keys()] }
    );
}

// /ww begin

export async function handleBegin(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, message, isOwner } = ctx;

    if (!from.endsWith("@g.us")) {
        await Chisato.sendText(from, messages("id").onlyGroup, message);
        return;
    }

    const game = getGame(from);
    if (!game) {
        await Chisato.sendText(from, messages("id").noLobby, message);
        return;
    }

    const m = messages(game.lang);

    if (game.phase !== "lobby") {
        await Chisato.sendText(from, m.beginAlreadyStarted, message);
        return;
    }
    if (game.hostId !== sender && !isOwner) {
        await Chisato.sendText(from, m.beginNotHost, message);
        return;
    }
    if (game.players.size < 4) {
        await Chisato.sendText(from, m.beginMinPlayers(game.players.size), message);
        return;
    }

    // Resolve language from votes before assigning roles
    game.lang = resolveLang(game);
    const mFinal = messages(game.lang);

    assignRoles(game);
    game.phase = "night"; // set early to prevent race

    const playerList = [...game.players.values()]
        .map((p, i) => `${i + 1}. ${fmt(p.jid)}`)
        .join("\n");

    await Chisato.sendText(
        from,
        `${mFinal.gameStarting(game.players.size)}${playerList}\n\n${mFinal.rolesDelivered}`,
        message,
        { mentions: [...game.players.keys()] }
    );

    if (game.langVotes.size > 0) {
        await Chisato.sendText(from, mFinal.langFinal(game.lang));
    }

    // Send role cards via DM
    for (const player of game.players.values()) {
        const info = ROLE_INFO[player.role];
        const team = info.team === "village" ? mFinal.teamVillage : mFinal.teamWerewolf;
        const caption = mFinal.roleCardCaption(
            info.emoji,
            info.title,
            team,
            info.desc,
            from
        );

        const imgBuf = getRoleImageBuffer(player.role);
        if (imgBuf) {
            await Chisato.sendImage(player.jid, imgBuf, caption).catch(() =>
                Chisato.sendText(player.jid, caption).catch(() => {})
            );
        } else {
            await Chisato.sendText(player.jid, caption).catch(() => {});
        }

        // Tell wolves about each other
        if (player.role === "werewolf" || player.role === "alpha_werewolf") {
            const teammates = aliveWolves(game).filter((w) => w.jid !== player.jid);
            if (teammates.length > 0) {
                await Chisato.sendText(
                    player.jid,
                    mFinal.wolfTeammates(
                        teammates.map((w) => `• ${fmt(w.jid)} (${ROLE_INFO[w.role].title})`).join("\n")
                    )
                ).catch(() => {});
            }
        }

        // Tell minion about the wolves
        if (player.role === "minion") {
            const wolves = aliveWolves(game);
            await Chisato.sendText(
                player.jid,
                mFinal.minionWolves(
                    wolves.map((w) => `• ${fmt(w.jid)} (${ROLE_INFO[w.role].title})`).join("\n")
                )
            ).catch(() => {});
        }
    }

    // Brief pause then start first night
    await new Promise((r) => setTimeout(r, 3000));
    await startNightPhase(ctx, game);
}

// /ww help

export async function handleHelp(ctx: Ctx): Promise<void> {
    const { Chisato, from, message } = ctx;
    const game = getGame(from);
    const m = messages(game?.lang ?? "id");

    try {
        const imgBuf = fs.readFileSync(path.join(process.cwd(), "media", "werewolf.png"));
        await Chisato.sendImage(from, imgBuf, m.helpText, message);
    } catch {
        await Chisato.sendText(from, m.helpText, message);
    }
}
