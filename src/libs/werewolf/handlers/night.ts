import type { ConfigCommands } from "../../../types/structure/commands";
import {
    alivePlayers,
    aliveWolves,
    resolveGame,
    resolveTarget,
    submitWolfKill,
    ROLE_INFO,
} from "../index";
import { messages } from "../i18n";
import { fmt, triggerHunterShot, afterDayElimination } from "./flow";
import { resolveToPnJidSync } from "../../../utils/jid-resolver";

type Ctx = Parameters<ConfigCommands["run"]>[0];

// /ww kill

export async function handleKill(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, args, message } = ctx;

    const game = resolveGame(from, sender);
    if (!game || game.phase !== "night") return;

    const m = messages(game.lang);
    const wolf = game.players.get(sender);
    if (!wolf?.isAlive || (wolf.role !== "werewolf" && wolf.role !== "alpha_werewolf")) return;

    const target = resolveTarget(game, args[1], message?.mentions ?? []);
    if (!target) {
        await Chisato.sendText(from, m.invalidTarget, message);
        return;
    }
    if (target.role === "werewolf" || target.role === "alpha_werewolf") {
        await Chisato.sendText(from, m.wolfSelf, message);
        return;
    }

    const wolves = aliveWolves(game);
    const consensusTarget = submitWolfKill(game, sender, target.jid);

    if (wolves.length === 1) {
        await Chisato.sendText(from, m.wolfVoteSingle(fmt(target.jid)), message);
    } else {
        await Chisato.sendText(
            from,
            m.wolfVote(fmt(target.jid), game.night.werewolfVotes.size, wolves.length),
            message
        );
        if (consensusTarget) {
            await Chisato.sendText(from, m.wolfConsensus(fmt(consensusTarget)));
        }
    }
}

// /ww check

export async function handleCheck(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, args, message } = ctx;

    const game = resolveGame(from, sender);
    if (!game || game.phase !== "night") return;

    const m = messages(game.lang);
    const seer = game.players.get(sender);
    if (!seer?.isAlive || seer.role !== "seer") return;

    if (game.night.seerDone) {
        await Chisato.sendText(from, m.seerAlreadyDone, message);
        return;
    }

    const target = resolveTarget(game, args[1], message?.mentions ?? []);
    if (!target) {
        await Chisato.sendText(from, m.invalidTarget, message);
        return;
    }
    if (target.jid === sender) {
        await Chisato.sendText(from, m.seerSelf, message);
        return;
    }

    game.night.seerDone = true;

    // Alpha werewolf appears as villager to seer
    const appearsWolf =
        target.role === "werewolf" ||
        (target.role !== "alpha_werewolf" && ROLE_INFO[target.role].team === "werewolf");

    await Chisato.sendText(
        from,
        appearsWolf
            ? m.seerResultWolf(fmt(target.jid))
            : m.seerResultSafe(fmt(target.jid)),
        message
    );
}

// /ww save

export async function handleSave(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, args, message } = ctx;

    const game = resolveGame(from, sender);
    if (!game || game.phase !== "night") return;

    const m = messages(game.lang);
    const doctor = game.players.get(sender);
    if (!doctor?.isAlive || doctor.role !== "doctor") return;

    if (game.night.doctorTarget) {
        await Chisato.sendText(from, m.doctorAlreadySaved, message);
        return;
    }

    const target = resolveTarget(game, args[1], message?.mentions ?? []);
    if (!target) {
        await Chisato.sendText(from, m.invalidTarget, message);
        return;
    }
    if (target.jid === game.lastDoctorSave) {
        await Chisato.sendText(from, m.doctorSamePerson, message);
        return;
    }

    game.night.doctorTarget = target.jid;
    await Chisato.sendText(from, m.doctorSaved(fmt(target.jid)), message);
}

// /ww poison

export async function handlePoison(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, args, message } = ctx;

    const game = resolveGame(from, sender);
    if (!game || game.phase !== "night") return;

    const m = messages(game.lang);
    const witch = game.players.get(sender);
    if (!witch?.isAlive || witch.role !== "witch") return;

    if (witch.witchPoisonUsed) {
        await Chisato.sendText(from, m.witchPoisonUsed, message);
        return;
    }

    const target = resolveTarget(game, args[1], message?.mentions ?? []);
    if (!target) {
        await Chisato.sendText(from, m.invalidTarget, message);
        return;
    }

    game.night.witchPoison = target.jid;
    witch.witchPoisonUsed = true;
    await Chisato.sendText(from, m.witchPoisonOk(fmt(target.jid)), message);
}

// /ww heal

export async function handleHeal(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, args, message } = ctx;

    const game = resolveGame(from, sender);
    if (!game || game.phase !== "night") return;

    const m = messages(game.lang);
    const witch = game.players.get(sender);
    if (!witch?.isAlive || witch.role !== "witch") return;

    if (witch.witchHealUsed) {
        await Chisato.sendText(from, m.witchHealUsed, message);
        return;
    }

    const target = resolveTarget(game, args[1], message?.mentions ?? []);
    if (!target) {
        await Chisato.sendText(from, m.invalidTarget, message);
        return;
    }

    // Piggyback doctor target slot so resolveNight honours the save
    game.night.witchHeal = true;
    game.night.doctorTarget = target.jid;
    witch.witchHealUsed = true;
    await Chisato.sendText(from, m.witchHealOk(fmt(target.jid)), message);
}

// /ww protect

export async function handleProtect(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, args, message } = ctx;

    const game = resolveGame(from, sender);
    if (!game || game.phase !== "night") return;

    const m = messages(game.lang);
    const bg = game.players.get(sender);
    if (!bg?.isAlive || bg.role !== "bodyguard") return;

    if (bg.hasUsedShield) {
        await Chisato.sendText(from, m.bodyguardUsed, message);
        return;
    }

    const target = resolveTarget(game, args[1], message?.mentions ?? []);
    if (!target) {
        await Chisato.sendText(from, m.invalidTarget, message);
        return;
    }
    if (target.jid === sender) {
        await Chisato.sendText(from, m.bodyguardSelf, message);
        return;
    }

    game.night.bodyguardTarget = target.jid;
    await Chisato.sendText(from, m.bodyguardOk(fmt(target.jid)), message);
}

// /ww shoot

export async function handleShoot(ctx: Ctx): Promise<void> {
    const { Chisato, from, sender, args, message } = ctx;

    const game = resolveGame(from, sender);
    if (!game || game.pendingHunterShot !== sender) return;

    const m = messages(game.lang);
    const target = resolveTarget(game, args[1], message?.mentions ?? []);
    if (!target) {
        await Chisato.sendText(from, m.invalidTarget, message);
        return;
    }

    target.isAlive = false;
    game.pendingHunterShot = undefined;
    if (game.timer) clearTimeout(game.timer);

    const roleInfo = ROLE_INFO[target.role];
    await Chisato.sendText(
        game.groupId,
        m.hunterShot(fmt(sender), fmt(target.jid), roleInfo.emoji, roleInfo.title),
        null,
        { mentions: [resolveToPnJidSync(sender), resolveToPnJidSync(target.jid)] }
    );

    await afterDayElimination(ctx, game);
}
