import { FastifyInstance } from "fastify";
import { Database } from "../../infrastructure/database";
import { getClientInstance } from "../../libs/client/instance";
import { logger } from "../../core/logger";

export async function groupsRoutes(fastify: FastifyInstance) {
    // Get all groups
    fastify.get("/", async (request, reply) => {
        try {
            const {
                page = 1,
                limit = 10,
                search = "",
                communityType = "",
            } = request.query as {
                page?: number;
                limit?: number;
                search?: string;
                communityType?: string;
            };

            const skip = (Number(page) - 1) * Number(limit);

            let typeFilter: Record<string, boolean> = {};
            if (communityType === "community") {
                typeFilter = { isCommunity: true };
            } else if (communityType === "communityAnnounce") {
                typeFilter = { isCommunityAnnounce: true };
            } else if (communityType === "regular") {
                typeFilter = { isCommunity: false, isCommunityAnnounce: false };
            }

            const where = {
                ...(search
                    ? {
                          subject: {
                              contains: search,
                              mode: "insensitive" as const,
                          },
                      }
                    : {}),
                ...typeFilter,
            };

            const [groups, total] = await Promise.all([
                Database.group.findMany({
                    where,
                    skip,
                    take: Number(limit),
                    select: {
                        groupId: true,
                        subject: true,
                        size: true,
                        owner: true,
                        creation: true,
                        participants: true,
                        settings: true,
                        announce: true,
                        restrict: true,
                        memberAddMode: true,
                        isCommunity: true,
                        isCommunityAnnounce: true,
                    },
                }),
                Database.group.count({ where }),
            ]);

            const client = getClientInstance();
            const botJid = client?.user?.id?.split(":")[0] || "";

            return {
                groups: groups.map((g) => {
                    const botParticipant = botJid
                        ? g.participants?.find((p) =>
                              p.id?.split(":")[0] === botJid ||
                              p.lid?.split(":")[0] === botJid
                          )
                        : undefined;
                    const botIsAdmin =
                        botParticipant?.admin === "admin" ||
                        botParticipant?.admin === "superadmin";
                    return {
                        ...g,
                        participantsCount: g.participants?.length || 0,
                        createdAt: new Date(g.creation * 1000).toISOString(),
                        botIsAdmin,
                    };
                }),
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit)),
                },
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch groups" });
        }
    });

    // Get single group details
    fastify.get("/:groupId", async (request, reply) => {
        try {
            const { groupId } = request.params as { groupId: string };

            // Fetch directly from database to ensure latest data
            const group = await Database.group.findUnique({
                where: { groupId },
            });

            if (!group) {
                return reply.status(404).send({ error: "Group not found" });
            }

            return {
                ...group,
                participantsCount: group.participants?.length || 0,
                createdAt: new Date(group.creation * 1000).toISOString(),
                descriptionUpdatedAt: group.descTime
                    ? new Date(group.descTime * 1000).toISOString()
                    : null,
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch group" });
        }
    });

    // Get group participants
    fastify.get("/:groupId/participants", async (request, reply) => {
        try {
            const { groupId } = request.params as { groupId: string };

            const group = await Database.group.findUnique({
                where: { groupId },
                select: {
                    participants: true,
                    owner: true,
                },
            });

            if (!group) {
                return reply.status(404).send({ error: "Group not found" });
            }

            return {
                owner: group.owner,
                participants: group.participants || [],
                total: group.participants?.length || 0,
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch participants" });
        }
    });

    // Get group settings
    fastify.get("/:groupId/settings", async (request, reply) => {
        try {
            const { groupId } = request.params as { groupId: string };

            const group = await Database.group.findUnique({
                where: { groupId },
                select: {
                    settings: true,
                    announce: true,
                    restrict: true,
                    memberAddMode: true,
                    joinApprovalMode: true,
                },
            });

            if (!group) {
                return reply.status(404).send({ error: "Group not found" });
            }

            return group;
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch settings" });
        }
    });

    // Get groups statistics
    fastify.get("/stats/summary", async (request, reply) => {
        try {
            const groups = await Database.group.findMany({
                select: {
                    size: true,
                    participants: true,
                    settings: true,
                },
            });

            const stats = {
                totalGroups: groups.length,
                totalParticipants: groups.reduce(
                    (sum, g) => sum + (g.participants?.length || 0),
                    0
                ),
                averageSize:
                    groups.reduce(
                        (sum, g) => sum + (g.participants?.length || 0),
                        0
                    ) / groups.length || 0,
                largestGroup: Math.max(
                    ...groups.map((g) => g.participants?.length || 0)
                ),
                smallestGroup: Math.min(
                    ...groups.map((g) => g.participants?.length || 0)
                ),
                settings: {
                    antilink: groups.filter((g) => g.settings.antilink?.status)
                        .length,
                    antibot: groups.filter((g) => g.settings.antibot).length,
                    antidelete: groups.filter((g) => (g.settings as any).antidelete).length,
                    welcome: groups.filter((g) => g.settings.welcome).length,
                    leave: groups.filter((g) => g.settings.leave).length,
                    notify: groups.filter((g) => g.settings.notify).length,
                    mute: groups.filter((g) => g.settings.mute).length,
                },
            };

            return stats;
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch statistics" });
        }
    });

    // Update group settings
    fastify.put("/:groupId/settings", async (request, reply) => {
        try {
            const { groupId } = request.params as { groupId: string };
            const {
                antilinkStatus,
                antibot,
                antidelete,
                welcome,
                leave,
                notify,
                mute,
            } = request.body as {
                antilinkStatus?: boolean;
                antibot?: boolean;
                antidelete?: boolean;
                welcome?: boolean;
                leave?: boolean;
                notify?: boolean;
                mute?: boolean;
            };

            const existingGroup = await Database.group.findUnique({
                where: { groupId },
            });

            if (!existingGroup) {
                return reply.status(404).send({ error: "Group not found" });
            }

            const settings: any = { ...existingGroup.settings };
            if (antilinkStatus !== undefined) {
                settings.antilink = {
                    ...settings.antilink,
                    status: antilinkStatus,
                };
            }
            if (antibot !== undefined) settings.antibot = antibot;
            if (antidelete !== undefined) settings.antidelete = antidelete;
            if (welcome !== undefined) settings.welcome = welcome;
            if (leave !== undefined) settings.leave = leave;
            if (notify !== undefined) settings.notify = notify;
            if (mute !== undefined) settings.mute = mute;

            const group = await Database.group.update({
                where: { groupId },
                data: { settings },
            });

            return {
                success: true,
                message: "Group settings updated successfully",
                settings: group.settings,
            };
        } catch (error) {
            reply
                .status(500)
                .send({ error: "Failed to update group settings" });
        }
    });

    // Sync database with live WhatsApp groups
    fastify.post("/sync", async (_request, reply) => {
        const client = getClientInstance();
        if (!client) {
            return reply.status(503).send({
                success: false,
                error: "Bot client is not connected",
            });
        }

        try {
            const groupDatabase = await Database.group.findMany({
                select: { groupId: true },
            });
            const groupDatabaseIDs = groupDatabase.map((g) => g.groupId);
            const groupFetch = await client.groupFetchAllParticipating();
            const groupFetchIDs = Object.keys(groupFetch);

            let updated = 0;
            let removed = 0;
            let failed = 0;

            for (const groupId of groupDatabaseIDs) {
                try {
                    if (groupFetchIDs.includes(groupId)) {
                        const groupMetadata: any = { ...groupFetch[groupId] };
                        delete groupMetadata.id;
                        delete groupMetadata.subjectOwner;
                        delete groupMetadata.subjectTime;
                        delete groupMetadata.descId;
                        groupMetadata.ephemeralDuration =
                            groupMetadata.ephemeralDuration || 0;

                        try {
                            await Database.group.update({
                                where: { groupId },
                                data: groupMetadata,
                            });
                        } catch {
                            await Database.group.deleteMany({ where: { groupId } });
                            await Database.group.create({
                                data: { groupId, ...groupMetadata },
                            });
                        }
                        updated++;
                    } else {
                        await Database.group.deleteMany({ where: { groupId } });
                        removed++;
                    }
                } catch (err) {
                    failed++;
                    logger.error(
                        `Dashboard syncdb: failed to process ${groupId}: ${
                            err instanceof Error ? err.message : String(err)
                        }`
                    );
                }
            }

            const total = await Database.group.count();

            return reply.send({
                success: true,
                message: "Sync database completed",
                stats: { total, updated, removed, failed },
            });
        } catch (error) {
            logger.error("Dashboard syncdb error:", error);
            return reply.status(500).send({
                success: false,
                error: "Failed to sync groups",
            });
        }
    });

    // Join group via invite link
    fastify.post("/join", async (request, reply) => {
        try {
            const { inviteLink } = request.body as { inviteLink: string };
            if (!inviteLink?.trim()) {
                return reply.status(400).send({ success: false, error: "Invite link is required" });
            }

            const match = inviteLink.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i);
            if (!match) {
                return reply.status(400).send({ success: false, error: "Invalid WhatsApp group invite link" });
            }

            const inviteCode = match[1];
            const client = getClientInstance();
            if (!client) {
                return reply.status(503).send({ success: false, error: "Bot client is not connected" });
            }

            const groupInfo = await client.groupGetInviteInfo(inviteCode);

            // Check if bot is already in the group
            if (groupInfo?.id) {
                try {
                    await client.groupMetadata(groupInfo.id);
                    return reply.status(409).send({
                        success: false,
                        error: `Bot is already in this group: ${groupInfo.subject || groupInfo.id}`,
                    });
                } catch {}
            }

            const resultId = await client.groupAcceptInvite(inviteCode);

            const joinedGroupId = resultId || groupInfo?.id;

            // Send greeting after a short delay to let WA register the join
            if (joinedGroupId) {
                setTimeout(async () => {
                    try {
                        await client.sendMessage(joinedGroupId, {
                            text:
                                `👋 *Hello Everyone!*\n\n` +
                                `I'm ChisatoBot, thanks for inviting me to this group!\n\n` +
                                `Type *.menu* to see all available commands.\n\n` +
                                `Let's have fun together! 🎉`,
                        });
                    } catch (e) {
                        logger.warn(`Failed to send join greeting to ${joinedGroupId}: ${e}`);
                    }
                }, 3000);
            }

            return reply.send({
                success: true,
                message: "Successfully joined group",
                group: {
                    id: resultId || groupInfo?.id,
                    subject: groupInfo?.subject || "Unknown",
                    size: groupInfo?.size || 0,
                },
            });
        } catch (error: any) {
            logger.error("Join group error:", error);
            const msg = error?.message || "Failed to join group";
            const isNotFound = msg.toLowerCase().includes("not-found") || msg.toLowerCase().includes("not found");
            return reply.status(isNotFound ? 404 : 500).send({
                success: false,
                error: isNotFound ? "Invite link is expired or invalid" : msg,
            });
        }
    });

    // Delete group
    fastify.delete("/:groupId", async (request, reply) => {
        try {
            const { groupId } = request.params as { groupId: string };

            const existingGroup = await Database.group.findUnique({
                where: { groupId },
            });

            if (!existingGroup) {
                return reply.status(404).send({ error: "Group not found" });
            }

            // Leave the group first
            const client = getClientInstance();
            if (client) {
                try {
                    await client.groupLeave(groupId);
                } catch (leaveError) {
                    logger.error("Could not leave group (might already be removed):", leaveError);
                }
            }

            // Delete from database
            await Database.group.delete({
                where: { groupId },
            });

            return {
                success: true,
                message:
                    "Group deleted successfully and bot has left the group",
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to delete group" });
        }
    });
}
