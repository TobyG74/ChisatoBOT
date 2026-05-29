import type { ConfigCommands } from "../../../types/structure/commands";
import {
    alivePlayers,
    aliveWolves,
    checkWinCondition,
    createNightState,
    endGame,
    resolveNight,
    resolveVote,
    tallyVotes,
    ROLE_INFO,
} from "../index";
import type { Game, Player } from "../index";
import { messages } from "../i18n";
import { resolveAllToPnJids, resolveToPnJidSync } from "../../../utils/jid-resolver";

type Ctx = Parameters<ConfigCommands["run"]>[0];

// Formatting helpers
export function fmt(jid: string): string {
    const pn = resolveToPnJidSync(jid);
    return `@${(pn || jid).split("@")[0]}`;
}

// Win announcement
export async function announceWin(
    ctx: Ctx,
    game: Game,
    winner: "village" | "werewolf"
): Promise<void> {
    const m = messages(game.lang);
    const roleReveal = [...game.players.values()]
        .map(
            (p) =>
                `• ${fmt(p.jid)} → ${ROLE_INFO[p.role].emoji} *${ROLE_INFO[p.role].title}*${p.isAlive ? "" : " 💀"}`
        )
        .join("\n");

    const header = winner === "village" ? m.winVillage : m.winWolf;

    const playerJids = [...game.players.keys()];
    const playerPnJids = await resolveAllToPnJids(ctx.Chisato, playerJids);

    await ctx.Chisato.sendText(
        game.groupId,
        `${header}${m.roleRevealHeader}${roleReveal}${m.thankYou}`,
        null,
        { mentions: playerPnJids }
    );

    endGame(game.groupId);
}

// Night phase
export async function startNightPhase(ctx: Ctx, game: Game): Promise<void> {
    if (game.phase === "ended") return;
    game.phase = "night";
    game.night = createNightState();

    const m = messages(game.lang);
    const alive = alivePlayers(game);
    const wolves = aliveWolves(game);

    const alivePnJids = await resolveAllToPnJids(
        ctx.Chisato,
        alive.map((p) => p.jid)
    );
    const aliveList = alive
        .map((_, i) => `${i + 1}. @${alivePnJids[i].split("@")[0]}`)
        .join("\n");

    await ctx.Chisato.sendText(
        game.groupId,
        m.nightStart(game.round + 1, alive.length, aliveList),
        null,
        { mentions: alivePnJids }
    );

    const dmTarget = (p: Player): string => {
        const idx = alive.indexOf(p);
        return idx >= 0 ? alivePnJids[idx] : p.jid;
    };

    // Notify werewolves — DM each wolf privately so the group can't see roles.
    for (const wolf of wolves) {
        const teammates = wolves.filter((w) => w.jid !== wolf.jid);
        const teamStr =
            teammates.length > 0
                ? m.wolfTeammatesInline(
                      teammates.map((w) => `@${dmTarget(w).split("@")[0]}`).join(", ")
                  )
                : "\n";
        const teammateMentions = teammates.map((w) => dmTarget(w));
        await ctx.Chisato
            .sendText(
                dmTarget(wolf),
                m.wolfInstruction(teamStr, aliveList),
                null,
                { mentions: [...teammateMentions, ...alivePnJids] }
            )
            .catch(() => {});
    }

    // Notify seer (DM)
    const seer = alive.find((p) => p.role === "seer");
    if (seer) {
        await ctx.Chisato
            .sendText(dmTarget(seer), m.seerInstruction(aliveList), null, {
                mentions: alivePnJids,
            })
            .catch(() => {});
    }

    // Notify doctor (DM)
    const doctor = alive.find((p) => p.role === "doctor");
    if (doctor) {
        const selfNote = game.lastDoctorSave !== doctor.jid ? m.doctorSelfNote : "";
        await ctx.Chisato
            .sendText(
                dmTarget(doctor),
                m.doctorInstruction(selfNote, aliveList),
                null,
                { mentions: alivePnJids }
            )
            .catch(() => {});
    }

    // Notify witch (DM)
    const witch = alive.find((p) => p.role === "witch");
    if (witch) {
        const potions: string[] = [];
        if (!witch.witchHealUsed) potions.push(m.witchHealPotion);
        if (!witch.witchPoisonUsed) potions.push(m.witchPoisonPotion);
        if (potions.length > 0) {
            await ctx.Chisato
                .sendText(
                    dmTarget(witch),
                    m.witchInstruction(potions.join("\n"), aliveList),
                    null,
                    { mentions: alivePnJids }
                )
                .catch(() => {});
        }
    }

    // Notify bodyguard (DM)
    const bg = alive.find((p) => p.role === "bodyguard" && !p.hasUsedShield);
    if (bg) {
        await ctx.Chisato
            .sendText(dmTarget(bg), m.bodyguardInstruction(aliveList), null, {
                mentions: alivePnJids,
            })
            .catch(() => {});
    }

    // Auto-resolve after 90s
    if (game.timer) clearTimeout(game.timer);
    game.timer = setTimeout(() => resolveNightPhase(ctx, game), 90_000);
}

async function resolveNightPhase(ctx: Ctx, game: Game): Promise<void> {
    if (game.phase !== "night") return;
    if (game.timer) clearTimeout(game.timer);

    const m = messages(game.lang);
    const { killed, killedBy, protected: wasProtected } = resolveNight(game);

    let msg = "";
    const mentions: string[] = [];

    const killedPn = killed ? resolveToPnJidSync(killed.jid) : "";

    if (!killed && !wasProtected) {
        msg = m.dawnSafe;
    } else if (wasProtected) {
        msg = m.dawnProtected;
    } else if (killed && killedBy === "bodyguard_trade") {
        mentions.push(killedPn);
        msg = m.dawnBodyguardTrade(fmt(killed.jid), ROLE_INFO[killed.role].emoji, ROLE_INFO[killed.role].title);
    } else if (killed) {
        mentions.push(killedPn);
        if (!killed.isAlive) {
            msg = m.dawnKilled(fmt(killed.jid), ROLE_INFO[killed.role].emoji, ROLE_INFO[killed.role].title);
        } else {
            msg = m.cursedTurned(fmt(killed.jid));
        }
    }

    await ctx.Chisato.sendText(game.groupId, msg, null, { mentions });

    // Hunter trigger on night death
    if (killed && !killed.isAlive && killed.role === "hunter") {
        await triggerHunterShot(ctx, game, killed, "day");
        return;
    }

    await continueToDay(ctx, game);
}

export async function triggerHunterShot(
    ctx: Ctx,
    game: Game,
    hunter: Player,
    after: "day" | "elimination"
): Promise<void> {
    const m = messages(game.lang);
    game.pendingHunterShot = hunter.jid;

    const alive = alivePlayers(game);
    const alivePnJids = await resolveAllToPnJids(
        ctx.Chisato,
        alive.map((p) => p.jid)
    );
    const list = alive
        .map((_, i) => `${i + 1}. @${alivePnJids[i].split("@")[0]}`)
        .join("\n");
    const hunterPn = resolveToPnJidSync(hunter.jid);

    await ctx.Chisato.sendText(
        game.groupId,
        m.hunterPrompt(fmt(hunter.jid), list),
        null,
        { mentions: [hunterPn, ...alivePnJids] }
    );

    if (game.timer) clearTimeout(game.timer);
    game.timer = setTimeout(async () => {
        if (!game.pendingHunterShot) return;
        game.pendingHunterShot = undefined;
        if (after === "day") await continueToDay(ctx, game);
        else await afterDayElimination(ctx, game);
    }, 60_000);
}

async function continueToDay(ctx: Ctx, game: Game): Promise<void> {
    const winner = checkWinCondition(game);
    if (winner) {
        await announceWin(ctx, game, winner);
        return;
    }
    await startDayPhase(ctx, game);
}

// Day phase
async function startDayPhase(ctx: Ctx, game: Game): Promise<void> {
    game.phase = "day";
    game.dayVotes.clear();

    const m = messages(game.lang);
    const alive = alivePlayers(game);
    const alivePnJids = await resolveAllToPnJids(
        ctx.Chisato,
        alive.map((p) => p.jid)
    );
    const list = alive
        .map((_, i) => `${i + 1}. @${alivePnJids[i].split("@")[0]}`)
        .join("\n");

    await ctx.Chisato.sendText(
        game.groupId,
        m.dayStart(game.round, alive.length, list),
        null,
        { mentions: alivePnJids }
    );

    if (game.voteTimer) clearTimeout(game.voteTimer);
    game.voteTimer = setTimeout(() => resolveVotePhase(ctx, game), 120_000);
}

export async function resolveVotePhase(ctx: Ctx, game: Game): Promise<void> {
    if (game.phase !== "day") return;
    if (game.voteTimer) clearTimeout(game.voteTimer);

    const m = messages(game.lang);
    const tally = tallyVotes(game);

    if (tally.size === 0) {
        await ctx.Chisato.sendText(game.groupId, m.noVotes);
        await startNightPhase(ctx, game);
        return;
    }

    const tallyStr = [...tally.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([jid, v]) => `• ${fmt(jid)}: ${v}`)
        .join("\n");
    const tallyPnJids = await resolveAllToPnJids(ctx.Chisato, [...tally.keys()]);

    await ctx.Chisato.sendText(
        game.groupId,
        `${m.voteResultHeader}${tallyStr}`,
        null,
        { mentions: tallyPnJids }
    );

    const eliminated = resolveVote(game);

    if (!eliminated) {
        await ctx.Chisato.sendText(game.groupId, m.voteTie);
        await startNightPhase(ctx, game);
        return;
    }

    const roleInfo = ROLE_INFO[eliminated.role];
    const eliminatedPn = resolveToPnJidSync(eliminated.jid);

    // Kid rule: village loses immediately if kid voted out
    if (eliminated.role === "kid") {
        await ctx.Chisato.sendText(
            game.groupId,
            m.kidEliminated(fmt(eliminated.jid)),
            null,
            { mentions: [eliminatedPn] }
        );
        await announceWin(ctx, game, "werewolf");
        return;
    }

    await ctx.Chisato.sendText(
        game.groupId,
        m.eliminated(fmt(eliminated.jid), roleInfo.emoji, roleInfo.title),
        null,
        { mentions: [eliminatedPn] }
    );

    // Hunter on vote-elimination
    if (eliminated.role === "hunter") {
        await triggerHunterShot(ctx, game, eliminated, "elimination");
        return;
    }

    await afterDayElimination(ctx, game);
}

export async function afterDayElimination(ctx: Ctx, game: Game): Promise<void> {
    const winner = checkWinCondition(game);
    if (winner) {
        await announceWin(ctx, game, winner);
        return;
    }
    await startNightPhase(ctx, game);
}
