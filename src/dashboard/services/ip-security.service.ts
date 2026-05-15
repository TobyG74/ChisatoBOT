/**
 * IpSecurityService
 * singleton that keeps IP whitelist/blacklist in memory
 */

import { PrismaClient } from "@prisma/client";
import { configService } from "../../core/config/config.service";
import { logger } from "../../core/logger/logger.service";

const CONFIG_KEY = "default";

class IpSecurityService {
    private static instance: IpSecurityService;
    private whitelist: Set<string> = new Set();
    private blacklist: Set<string> = new Set();
    private prisma: PrismaClient | null = null;
    private docId: string | null = null; // cached MongoDB _id for the config doc
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
                this.whitelist = new Set(doc.ipWhitelist);
                this.blacklist = new Set(doc.ipBlacklist);
            } else {
                // Seed from config.json the first time
                const cfgDashboard = configService.getConfig().dashboard ?? { ipWhitelist: [], ipBlacklist: [] };
                this.whitelist = new Set(cfgDashboard.ipWhitelist ?? []);
                this.blacklist = new Set(cfgDashboard.ipBlacklist ?? []);
                const created = await prisma.dashboardConfig.create({
                    data: {
                        key: CONFIG_KEY,
                        ipWhitelist: [...this.whitelist],
                        ipBlacklist: [...this.blacklist],
                    },
                });
                this.docId = created.id;
                logger.info("IpSecurityService: seeded from config.json into DB");
            }
        } catch (err) {
            logger.error(`IpSecurityService: failed to load from DB — using config.json fallback. ${err}`);
            const cfgDashboard = configService.getConfig().dashboard ?? { ipWhitelist: [], ipBlacklist: [] };
            this.whitelist = new Set(cfgDashboard.ipWhitelist ?? []);
            this.blacklist = new Set(cfgDashboard.ipBlacklist ?? []);
        }

        this.initialized = true;
    }

    // Sync reads (safe for middleware)

    public isBlocked(ip: string): boolean {
        return this.blacklist.has(ip);
    }

    public isWhitelisted(ip: string): boolean {
        return this.whitelist.has(ip);
    }

    public getLists(): { ipWhitelist: string[]; ipBlacklist: string[] } {
        return {
            ipWhitelist: [...this.whitelist],
            ipBlacklist: [...this.blacklist],
        };
    }

    public async addToWhitelist(ip: string): Promise<void> {
        if (this.whitelist.has(ip)) return;
        this.whitelist.add(ip);
        this.blacklist.delete(ip); // mutual exclusion
        await this.persist();
    }

    public async removeFromWhitelist(ip: string): Promise<void> {
        this.whitelist.delete(ip);
        await this.persist();
    }

    public async addToBlacklist(ip: string): Promise<void> {
        if (this.blacklist.has(ip)) return;
        this.blacklist.add(ip);
        this.whitelist.delete(ip); // mutual exclusion
        await this.persist();
    }

    public async removeFromBlacklist(ip: string): Promise<void> {
        this.blacklist.delete(ip);
        await this.persist();
    }

    // Internal

    private async persist(): Promise<void> {
        if (!this.prisma) return;
        const data = {
            ipWhitelist: [...this.whitelist],
            ipBlacklist: [...this.blacklist],
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
