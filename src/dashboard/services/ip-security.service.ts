/**
 * IpSecurityService
 * singleton that keeps IP whitelist/blacklist in memory, tagged per-role.
 *
 * Roles: "owner" | "team" | "unknown"
 *
 * Persistence format (backwards-compatible with existing String[] columns):
 *   - Each list element is stored as `"<role>:<ip>"` (e.g. "owner:1.2.3.4").
 *   - Plain strings without a colon prefix are treated as legacy entries with
 *     role = "unknown" so existing data isn't lost. They get rewritten to the
 *     new format the next time the list is mutated.
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../../core/logger/logger.service";

const CONFIG_KEY = "default";

export type IpRole = "owner" | "team" | "unknown";

export interface IpEntry {
    ip: string;
    role: IpRole;
}

const VALID_ROLES: IpRole[] = ["owner", "team", "unknown"];

function parseEntry(raw: string): IpEntry | null {
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) {
        // Legacy entry without role prefix
        return { ip: trimmed, role: "unknown" };
    }
    const role = trimmed.slice(0, idx).toLowerCase() as IpRole;
    const ip = trimmed.slice(idx + 1).trim();
    if (!ip) return null;
    // IPv6 addresses contain ":" — if the prefix is not a known role, treat
    // the whole string as the IP itself (legacy / IPv6).
    if (!VALID_ROLES.includes(role)) {
        return { ip: trimmed, role: "unknown" };
    }
    return { ip, role };
}

function encodeEntry(entry: IpEntry): string {
    return `${entry.role}:${entry.ip}`;
}

class IpSecurityService {
    private static instance: IpSecurityService;

    /** ip → role */
    private whitelist: Map<string, IpRole> = new Map();
    private blacklist: Map<string, IpRole> = new Map();

    private prisma: PrismaClient | null = null;
    private docId: string | null = null;
    private initialized = false;

    private constructor() {}

    public static getInstance(): IpSecurityService {
        if (!IpSecurityService.instance) {
            IpSecurityService.instance = new IpSecurityService();
        }
        return IpSecurityService.instance;
    }

    /** Call once at dashboard server startup. */
    public async init(prisma: PrismaClient): Promise<void> {
        if (this.initialized) return;
        this.prisma = prisma;

        try {
            const doc = await prisma.dashboardConfig.findFirst({ where: { key: CONFIG_KEY } });

            if (doc) {
                this.docId = doc.id;
                this.whitelist = this.decodeList(doc.ipWhitelist);
                this.blacklist = this.decodeList(doc.ipBlacklist);
            } else {
                this.whitelist = new Map();
                this.blacklist = new Map();
                const created = await prisma.dashboardConfig.create({
                    data: {
                        key: CONFIG_KEY,
                        ipWhitelist: [],
                        ipBlacklist: [],
                    },
                });
                this.docId = created.id;
                logger.info("IpSecurityService: created empty IP lists in DB");
            }
        } catch (err) {
            logger.error(`IpSecurityService: failed to load from DB — using empty lists. ${err}`);
            this.whitelist = new Map();
            this.blacklist = new Map();
        }

        this.initialized = true;
    }

    // ---- Sync reads (safe for middleware) ----

    public isBlocked(ip: string): boolean {
        return this.blacklist.has(ip);
    }

    public isWhitelisted(ip: string): boolean {
        return this.whitelist.has(ip);
    }

    public getRole(ip: string, list: "whitelist" | "blacklist"): IpRole | null {
        const map = list === "whitelist" ? this.whitelist : this.blacklist;
        return map.get(ip) ?? null;
    }

    public getLists(): { ipWhitelist: IpEntry[]; ipBlacklist: IpEntry[] } {
        return {
            ipWhitelist: this.toEntries(this.whitelist),
            ipBlacklist: this.toEntries(this.blacklist),
        };
    }

    /** Group entries by role for UI rendering. */
    public getListsByRole(): {
        ipWhitelist: Record<IpRole, string[]>;
        ipBlacklist: Record<IpRole, string[]>;
    } {
        return {
            ipWhitelist: this.groupByRole(this.whitelist),
            ipBlacklist: this.groupByRole(this.blacklist),
        };
    }

    // ---- Mutations ----

    public async addToWhitelist(ip: string, role: IpRole = "unknown"): Promise<void> {
        const cleanIp = ip.trim();
        if (!cleanIp) return;
        const safeRole: IpRole = VALID_ROLES.includes(role) ? role : "unknown";
        const existingRole = this.whitelist.get(cleanIp);
        // Mutual exclusion with blacklist
        const wasBlacklisted = this.blacklist.delete(cleanIp);
        // Skip persistence only if nothing changed at all
        if (existingRole === safeRole && !wasBlacklisted) return;
        this.whitelist.set(cleanIp, safeRole);
        await this.persist();
    }

    public async removeFromWhitelist(ip: string): Promise<void> {
        if (!this.whitelist.delete(ip.trim())) return;
        await this.persist();
    }

    public async addToBlacklist(ip: string, role: IpRole = "unknown"): Promise<void> {
        const cleanIp = ip.trim();
        if (!cleanIp) return;
        const safeRole: IpRole = VALID_ROLES.includes(role) ? role : "unknown";
        const existingRole = this.blacklist.get(cleanIp);
        const wasWhitelisted = this.whitelist.delete(cleanIp);
        if (existingRole === safeRole && !wasWhitelisted) return;
        this.blacklist.set(cleanIp, safeRole);
        await this.persist();
    }

    public async removeFromBlacklist(ip: string): Promise<void> {
        if (!this.blacklist.delete(ip.trim())) return;
        await this.persist();
    }

    /**
     * Update a whitelist entry. Allows changing the IP address and/or the role
     * in one operation. Throws if `originalIp` is not in the whitelist or if
     * the new IP would clash with an unrelated existing entry.
     */
    public async updateWhitelistEntry(
        originalIp: string,
        newIp: string,
        newRole: IpRole = "unknown"
    ): Promise<void> {
        await this.updateEntry("whitelist", originalIp, newIp, newRole);
    }

    public async updateBlacklistEntry(
        originalIp: string,
        newIp: string,
        newRole: IpRole = "unknown"
    ): Promise<void> {
        await this.updateEntry("blacklist", originalIp, newIp, newRole);
    }

    private async updateEntry(
        list: "whitelist" | "blacklist",
        originalIp: string,
        newIp: string,
        newRole: IpRole
    ): Promise<void> {
        const cleanOriginal = originalIp.trim();
        const cleanNew = newIp.trim();
        if (!cleanOriginal || !cleanNew) {
            throw new Error("Both original and new IP addresses are required");
        }
        const safeRole: IpRole = VALID_ROLES.includes(newRole) ? newRole : "unknown";

        const target = list === "whitelist" ? this.whitelist : this.blacklist;
        const other = list === "whitelist" ? this.blacklist : this.whitelist;

        if (!target.has(cleanOriginal)) {
            throw new Error(`IP ${cleanOriginal} is not in the ${list}`);
        }
        // Reject if the new IP already exists in this list under a different
        // original (renaming would silently merge two entries).
        if (cleanNew !== cleanOriginal && target.has(cleanNew)) {
            throw new Error(`IP ${cleanNew} is already in the ${list}`);
        }

        target.delete(cleanOriginal);
        // Mutual exclusion: if the new IP is currently in the opposite list,
        // remove it from there.
        other.delete(cleanNew);
        target.set(cleanNew, safeRole);

        await this.persist();
    }

    // ---- Internal helpers ----

    private decodeList(raw: string[]): Map<string, IpRole> {
        const map = new Map<string, IpRole>();
        for (const item of raw) {
            const entry = parseEntry(item);
            if (entry) {
                map.set(entry.ip, entry.role);
            }
        }
        return map;
    }

    private encodeList(map: Map<string, IpRole>): string[] {
        return [...map.entries()].map(([ip, role]) => encodeEntry({ ip, role }));
    }

    private toEntries(map: Map<string, IpRole>): IpEntry[] {
        return [...map.entries()].map(([ip, role]) => ({ ip, role }));
    }

    private groupByRole(map: Map<string, IpRole>): Record<IpRole, string[]> {
        const grouped: Record<IpRole, string[]> = { owner: [], team: [], unknown: [] };
        for (const [ip, role] of map.entries()) {
            grouped[role].push(ip);
        }
        return grouped;
    }

    private async persist(): Promise<void> {
        if (!this.prisma) return;
        const data = {
            ipWhitelist: this.encodeList(this.whitelist),
            ipBlacklist: this.encodeList(this.blacklist),
        };
        try {
            if (this.docId) {
                await this.prisma.dashboardConfig.update({
                    where: { id: this.docId },
                    data,
                });
            } else {
                const created = await this.prisma.dashboardConfig.create({
                    data: { key: CONFIG_KEY, ...data },
                });
                this.docId = created.id;
            }
        } catch (err) {
            logger.error(`IpSecurityService: failed to persist to DB. ${err}`);
        }
    }
}

export const ipSecurityService = IpSecurityService.getInstance();
