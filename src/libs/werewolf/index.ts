import fs from "fs";
import path from "path";

// Types
export type Role =
    | "villager"
    | "werewolf"
    | "alpha_werewolf"
    | "seer"
    | "doctor"
    | "bodyguard"
    | "witch"
    | "hunter"
    | "mayor"
    | "minion"
    | "cursed"
    | "kid";

export type Team = "village" | "werewolf";
export type Phase = "lobby" | "night" | "day" | "ended";
export type Lang = "en" | "id";

export interface Player {
    jid: string;
    name: string;
    role: Role;
    isAlive: boolean;
    hasUsedShield: boolean; // bodyguard one-time shield
    witchHealUsed: boolean;
    witchPoisonUsed: boolean;
}

export interface NightState {
    werewolfVotes: Map<string, string>; // wolf jid -> target jid
    resolvedKill?: string;
    seerDone: boolean;
    doctorTarget?: string;
    witchPoison?: string;
    witchHeal: boolean;
    bodyguardTarget?: string;
    submitted: Set<string>;
}

export interface Game {
    groupId: string;
    hostId: string;
    players: Map<string, Player>;
    phase: Phase;
    round: number;
    night: NightState;
    dayVotes: Map<string, string>; // voter jid -> target jid
    lastDoctorSave?: string;
    pendingHunterShot?: string;
    timer?: ReturnType<typeof setTimeout>;
    voteTimer?: ReturnType<typeof setTimeout>;
    lang: Lang;
    langVotes: Map<string, Lang>;
}

// Role info
export const ROLE_INFO: Record<
    Role,
    { team: Team; emoji: string; title: string; desc: string }
> = {
    villager: {
        team: "village",
        emoji: "👨‍🌾",
        title: "Warga",
        desc: "Warga biasa. Gunakan logika dan diskusi untuk menemukan serigala!",
    },
    werewolf: {
        team: "werewolf",
        emoji: "🐺",
        title: "Serigala",
        desc: "Bunuh satu warga setiap malam. Kalahkan tim desa!",
    },
    alpha_werewolf: {
        team: "werewolf",
        emoji: "🐺",
        title: "Alpha Serigala",
        desc: "Imun dari penglihatan Peramal! Bunuh bersama serigala lain setiap malam.",
    },
    seer: {
        team: "village",
        emoji: "🔮",
        title: "Peramal",
        desc: "Setiap malam kamu bisa mengecek apakah seseorang Serigala atau bukan.",
    },
    doctor: {
        team: "village",
        emoji: "🩺",
        title: "Dokter",
        desc: "Setiap malam kamu bisa menyelamatkan satu orang dari serangan malam. Tidak bisa menyelamatkan orang yang sama 2 malam berturut-turut.",
    },
    bodyguard: {
        team: "village",
        emoji: "🛡️",
        title: "Pengawal",
        desc: "Sekali per game, kamu bisa melindungi pemain lain. Jika mereka diserang, kamu yang mati.",
    },
    witch: {
        team: "village",
        emoji: "🧪",
        title: "Penyihir",
        desc: "Kamu punya 1 ramuan penyembuh dan 1 ramuan racun. Gunakan bijak!",
    },
    hunter: {
        team: "village",
        emoji: "🏹",
        title: "Pemburu",
        desc: "Jika kamu mati kapanpun, kamu bisa menembak 1 pemain sebelum pergi.",
    },
    mayor: {
        team: "village",
        emoji: "🎖️",
        title: "Walikota",
        desc: "Suaramu bernilai 2 saat voting siang!",
    },
    minion: {
        team: "werewolf",
        emoji: "😈",
        title: "Antek",
        desc: "Kamu tahu siapa serigalanya! Bantu mereka menang. Desa menang jika semua serigala mati, termasuk kamu.",
    },
    cursed: {
        team: "village",
        emoji: "💀",
        title: "Terkutuk",
        desc: "Jika diserang serigala, kamu berubah jadi serigala alih-alih mati!",
    },
    kid: {
        team: "village",
        emoji: "👶",
        title: "Anak Kecil",
        desc: "Jika kamu divoting keluar oleh desa, desa langsung KALAH!",
    },
};

const ROLE_IMAGE: Record<Role, string> = {
    villager: "villager.png",
    werewolf: "werewolf.png",
    alpha_werewolf: "alpha_werewolf.png",
    seer: "seer.png",
    doctor: "doctor.png",
    bodyguard: "bodyguard.png",
    witch: "witch.png",
    hunter: "hunter.png",
    mayor: "mayor.png",
    minion: "minion.png",
    cursed: "cursed.png",
    kid: "kid.png",
};

// Role pools by player count

function buildRolePool(count: number): Role[] {
    const presets: Role[][] = [
        // 4 players
        ["werewolf", "seer", "villager", "villager"],
        // 5
        ["werewolf", "seer", "doctor", "villager", "villager"],
        // 6
        ["werewolf", "werewolf", "seer", "doctor", "villager", "villager"],
        // 7
        ["werewolf", "werewolf", "seer", "doctor", "witch", "villager", "villager"],
        // 8
        ["werewolf", "werewolf", "seer", "doctor", "witch", "hunter", "villager", "villager"],
        // 9
        ["werewolf", "werewolf", "alpha_werewolf", "seer", "doctor", "witch", "hunter", "villager", "villager"],
        // 10
        ["werewolf", "werewolf", "alpha_werewolf", "seer", "doctor", "witch", "hunter", "bodyguard", "minion", "villager"],
        // 11
        ["werewolf", "werewolf", "alpha_werewolf", "seer", "doctor", "witch", "hunter", "bodyguard", "minion", "cursed", "villager"],
        // 12
        ["werewolf", "werewolf", "alpha_werewolf", "seer", "doctor", "witch", "hunter", "bodyguard", "minion", "cursed", "mayor", "villager"],
    ];

    if (count >= 4 && count <= 12) {
        return [...presets[count - 4]];
    }

    // 13+ players: extend from 12-player base
    const pool: Role[] = [...presets[8]];
    for (let i = 12; i < count; i++) {
        pool.push(i % 4 === 0 ? "werewolf" : "villager");
    }
    return pool;
}

// In-memory stores
const games = new Map<string, Game>();
const playerGameIndex = new Map<string, string>(); // playerJid -> groupId

// Helper: night state factory
export function createNightState(): NightState {
    return {
        werewolfVotes: new Map(),
        seerDone: false,
        witchHeal: false,
        submitted: new Set(),
    };
}

// Query helpers
export function getGame(groupId: string): Game | undefined {
    return games.get(groupId);
}

export function getGameByPlayer(playerJid: string): Game | undefined {
    const gid = playerGameIndex.get(playerJid);
    return gid ? games.get(gid) : undefined;
}

export function hasActiveGame(groupId: string): boolean {
    return games.has(groupId);
}

export function isInAnyGame(playerJid: string): boolean {
    return playerGameIndex.has(playerJid);
}

export function resolveGame(from: string, sender: string): Game | undefined {
    if (from.endsWith("@g.us")) return getGame(from);
    return getGameByPlayer(sender);
}

export function setLangVote(game: Game, playerJid: string, lang: Lang): void {
    game.langVotes.set(playerJid, lang);
}

export function resolveLang(game: Game): Lang {
    const en = [...game.langVotes.values()].filter((v) => v === "en").length;
    const id = [...game.langVotes.values()].filter((v) => v === "id").length;
    return en > id ? "en" : "id";
}

export function alivePlayers(game: Game): Player[] {
    return [...game.players.values()].filter((p) => p.isAlive);
}

export function aliveWolves(game: Game): Player[] {
    return alivePlayers(game).filter(
        (p) => p.role === "werewolf" || p.role === "alpha_werewolf"
    );
}

export function checkWinCondition(game: Game): "village" | "werewolf" | null {
    const wolves = aliveWolves(game);
    const village = alivePlayers(game).filter(
        (p) => ROLE_INFO[p.role].team === "village"
    );
    if (wolves.length === 0) return "village";
    if (wolves.length >= village.length) return "werewolf";
    return null;
}

export function getRoleImageBuffer(role: Role): Buffer | null {
    try {
        return fs.readFileSync(
            path.join(process.cwd(), "media", "werewolf_player", ROLE_IMAGE[role])
        );
    } catch {
        return null;
    }
}

/**
 * Resolve a player target from one of three forms:
 *   1. an @mention from the message context
 *   2. a phone number (`628xxxxxxx`, with or without `+`/spaces/dashes) — used
 *      in private chats where @mentions aren't available
 *   3. a small 1-based index into the alive-players list (1, 2, 3, …)
 *
 * Phone numbers and list indices are distinguished by digit length: anything
 * with 7+ digits is treated as a phone number, otherwise as an index. This
 * matters because `parseInt("6281311850715")` otherwise produces a huge index
 * that always misses the list.
 */
export function resolveTarget(
    game: Game,
    arg: string | undefined,
    mentions: string[]
): Player | null {
    if (mentions.length > 0) {
        const p = game.players.get(mentions[0]);
        return p?.isAlive ? p : null;
    }

    const raw = (arg ?? "").trim();
    if (!raw) return null;

    const digits = raw.replace(/\D/g, "");

    // Phone-number form (long digit string). Try the canonical PN JID first,
    // then scan as a fallback so we still match if the player was stored on a
    // non-`@s.whatsapp.net` server.
    if (digits.length >= 7) {
        const phoneJid = `${digits}@s.whatsapp.net`;
        const direct = game.players.get(phoneJid);
        if (direct?.isAlive) return direct;
        for (const player of game.players.values()) {
            if (player.isAlive && player.jid.split("@")[0] === digits) {
                return player;
            }
        }
        return null;
    }

    // Short numeric input → 1-based index into the alive list.
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0) {
        const alive = alivePlayers(game);
        return alive[num - 1] ?? null;
    }

    return null;
}

// Lobby management
export function createGame(
    groupId: string,
    hostId: string,
    hostName: string
): boolean {
    if (games.has(groupId)) return false;
    const game: Game = {
        groupId,
        hostId,
        players: new Map(),
        phase: "lobby",
        round: 0,
        night: createNightState(),
        dayVotes: new Map(),
        lang: "id",
        langVotes: new Map(),
    };
    game.players.set(hostId, makePlayer(hostId, hostName));
    playerGameIndex.set(hostId, groupId);
    games.set(groupId, game);
    return true;
}

function makePlayer(jid: string, name: string): Player {
    return {
        jid,
        name,
        role: "villager",
        isAlive: true,
        hasUsedShield: false,
        witchHealUsed: false,
        witchPoisonUsed: false,
    };
}

export type JoinResult =
    | "ok"
    | "no_game"
    | "already_joined"
    | "game_started"
    | "in_other_game";

export function joinGame(
    groupId: string,
    playerJid: string,
    playerName: string
): JoinResult {
    const game = games.get(groupId);
    if (!game) return "no_game";
    if (game.phase !== "lobby") return "game_started";
    if (game.players.has(playerJid)) return "already_joined";
    if (playerGameIndex.has(playerJid)) return "in_other_game";
    game.players.set(playerJid, makePlayer(playerJid, playerName));
    playerGameIndex.set(playerJid, groupId);
    return "ok";
}

export type LeaveResult = "ok" | "no_game" | "not_in_game" | "game_started";

export function leaveGame(
    groupId: string,
    playerJid: string
): LeaveResult {
    const game = games.get(groupId);
    if (!game) return "no_game";
    if (game.phase !== "lobby") return "game_started";
    if (!game.players.has(playerJid)) return "not_in_game";
    game.players.delete(playerJid);
    playerGameIndex.delete(playerJid);
    return "ok";
}

// Role assignment
export function assignRoles(game: Game): void {
    const pool = buildRolePool(game.players.size);
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let idx = 0;
    for (const player of game.players.values()) {
        player.role = pool[idx++];
    }
}

// Night actions
/** Submit a wolf kill vote. Returns consensus target jid if reached, else undefined. */
export function submitWolfKill(
    game: Game,
    wolfJid: string,
    targetJid: string
): string | undefined {
    game.night.werewolfVotes.set(wolfJid, targetJid);
    const wolves = aliveWolves(game);
    const votes = [...game.night.werewolfVotes.values()];

    if (wolves.length === 1 || game.night.werewolfVotes.size >= wolves.length) {
        // Most-voted target
        const tally = new Map<string, number>();
        for (const v of votes) tally.set(v, (tally.get(v) ?? 0) + 1);
        let best = "",
            bestCount = 0;
        for (const [jid, c] of tally) {
            if (c > bestCount) {
                best = jid;
                bestCount = c;
            }
        }
        game.night.resolvedKill = best;
        return best;
    }
    return undefined;
}

export interface NightResult {
    killed: Player | null;
    killedBy: "wolves" | "witch" | "bodyguard_trade" | null;
    protected: boolean;
}

export function resolveNight(game: Game): NightResult {
    const night = game.night;
    const killTarget = night.resolvedKill;

    let killed: Player | null = null;
    let killedBy: NightResult["killedBy"] = null;
    let protected_ = false;

    if (killTarget) {
        const target = game.players.get(killTarget);
        if (target?.isAlive) {
            const isSaved =
                night.doctorTarget === killTarget ||
                (night.witchHeal && night.bodyguardTarget !== killTarget);
            const bgProtects = night.bodyguardTarget === killTarget;

            if (isSaved && !bgProtects) {
                protected_ = true;
            } else if (bgProtects) {
                // Bodyguard sacrifices self
                const bg = [...game.players.values()].find(
                    (p) => p.role === "bodyguard" && p.isAlive && !p.hasUsedShield
                );
                if (bg) {
                    bg.hasUsedShield = true;
                    bg.isAlive = false;
                    killed = bg;
                    killedBy = "bodyguard_trade";
                } else {
                    // No eligible bodyguard, target dies normally
                    if (target.role === "cursed") {
                        target.role = "werewolf";
                    } else {
                        target.isAlive = false;
                        killed = target;
                        killedBy = "wolves";
                    }
                }
            } else {
                if (target.role === "cursed") {
                    target.role = "werewolf";
                } else {
                    target.isAlive = false;
                    killed = target;
                    killedBy = "wolves";
                }
            }
        }
    }

    // Witch poison (independent kill, can stack)
    if (night.witchPoison) {
        const pt = game.players.get(night.witchPoison);
        if (pt?.isAlive) {
            pt.isAlive = false;
            if (!killed) {
                killed = pt;
                killedBy = "witch";
            }
        }
    }

    // Track doctor's last save
    if (night.doctorTarget) game.lastDoctorSave = night.doctorTarget;
    else if (!night.witchHeal) game.lastDoctorSave = undefined;

    game.night = createNightState();
    game.round++;

    return { killed, killedBy, protected: protected_ };
}

// Day voting
export function submitVote(
    game: Game,
    voterJid: string,
    targetJid: string
): void {
    game.dayVotes.set(voterJid, targetJid);
}

export function tallyVotes(game: Game): Map<string, number> {
    const tally = new Map<string, number>();
    for (const [voter, target] of game.dayVotes) {
        const p = game.players.get(voter);
        const weight = p?.role === "mayor" ? 2 : 1;
        tally.set(target, (tally.get(target) ?? 0) + weight);
    }
    return tally;
}

/** Eliminate the leading vote-getter. Returns eliminated player or null on tie (random tiebreak). */
export function resolveVote(game: Game): Player | null {
    const tally = tallyVotes(game);
    if (tally.size === 0) return null;

    let maxVotes = 0;
    let leaders: string[] = [];
    for (const [jid, votes] of tally) {
        if (votes > maxVotes) {
            maxVotes = votes;
            leaders = [jid];
        } else if (votes === maxVotes) {
            leaders.push(jid);
        }
    }

    // Random tiebreak
    const winnerId = leaders[Math.floor(Math.random() * leaders.length)];
    const eliminated = game.players.get(winnerId) ?? null;
    if (eliminated) eliminated.isAlive = false;
    game.dayVotes.clear();
    return eliminated;
}

// Cleanup
export function endGame(groupId: string): void {
    const game = games.get(groupId);
    if (!game) return;
    if (game.timer) clearTimeout(game.timer);
    if (game.voteTimer) clearTimeout(game.voteTimer);
    for (const jid of game.players.keys()) {
        playerGameIndex.delete(jid);
    }
    games.delete(groupId);
}
