/**
 * group-audit.service
 *
 * Records who-did-what inside each group when actions are performed through
 * the group-admin dashboard, so other admins can see, e.g. "admin A renamed
 * the group" or "admin B kicked member X".
 */

import { Database } from "../../infrastructure/database";
import { logger } from "../../core/logger";

export type GroupAuditAction =
    | "login"
    | "rename"
    | "desc"
    | "kick"
    | "promote"
    | "demote"
    | "setting"
    | "wa-setting"
    | "profile-picture"
    | "revoke-link"
    | "welcome-config"
    | "leave-config"
    | "join";

export type GroupAuditEntry = {
    groupId: string;
    actorPn: string;
    actorName?: string | null;
    action: GroupAuditAction;
    detail?: string | null;
    target?: string | null;
};

export async function logGroupAction(entry: GroupAuditEntry): Promise<void> {
    try {
        await Database.groupAuditLog.create({
            data: {
                groupId: entry.groupId,
                actorPn: entry.actorPn,
                actorName: entry.actorName ?? null,
                action: entry.action,
                detail: entry.detail ?? null,
                target: entry.target ?? null,
                createdAt: Date.now(),
            },
        });
    } catch (err) {
        // Audit logging must never break the action it accompanies.
        logger.error(
            `Failed to write group audit log (${entry.action}/${entry.groupId}): ${
                err instanceof Error ? err.message : String(err)
            }`
        );
    }
}

export async function getGroupLogs(
    groupId: string,
    limit = 50,
    skip = 0
): Promise<{
    logs: Array<{
        actorPn: string;
        actorName: string | null;
        action: string;
        detail: string | null;
        target: string | null;
        createdAt: number;
    }>;
    total: number;
}> {
    const [logs, total] = await Promise.all([
        Database.groupAuditLog.findMany({
            where: { groupId },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: {
                actorPn: true,
                actorName: true,
                action: true,
                detail: true,
                target: true,
                createdAt: true,
            },
        }),
        Database.groupAuditLog.count({ where: { groupId } }),
    ]);

    return {
        logs: logs.map((l) => ({
            actorPn: l.actorPn,
            actorName: l.actorName ?? null,
            action: l.action,
            detail: l.detail ?? null,
            target: l.target ?? null,
            createdAt: Number(l.createdAt),
        })),
        total,
    };
}
