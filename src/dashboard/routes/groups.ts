import { FastifyInstance } from "fastify";
import { Database } from "../../infrastructure/database";
import { getClientInstance } from "../../libs/client/instance";

export async function groupsRoutes(fastify: FastifyInstance) {
    // Get all groups
    fastify.get("/", async (request, reply) => {
        try {
            const {
                page = 1,
                limit = 10,
                search = "",
            } = request.query as {
                page?: number;
                limit?: number;
                search?: string;
            };

            const skip = (Number(page) - 1) * Number(limit);

            const where = search
                ? {
                      subject: {
                          contains: search,
                          mode: "insensitive" as const,
                      },
                  }
                : {};

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
                    },
                }),
                Database.group.count({ where }),
            ]);

            return {
                groups: groups.map((g) => ({
                    ...g,
                    participantsCount: g.participants?.length || 0,
                    createdAt: new Date(g.creation * 1000).toISOString(),
                })),
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
                    welcome: groups.filter((g) => g.settings.welcome).length,
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
                welcome,
                notify,
                mute,
            } = request.body as {
                antilinkStatus?: boolean;
                antibot?: boolean;
                welcome?: boolean;
                notify?: boolean;
                mute?: boolean;
            };

            const existingGroup = await Database.group.findUnique({
                where: { groupId },
            });

            if (!existingGroup) {
                return reply.status(404).send({ error: "Group not found" });
            }

            const settings = { ...existingGroup.settings };
            if (antilinkStatus !== undefined) {
                settings.antilink = {
                    ...settings.antilink,
                    status: antilinkStatus,
                };
            }
            if (antibot !== undefined) settings.antibot = antibot;
            if (welcome !== undefined) settings.welcome = welcome;
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
                    console.log(
                        "Could not leave group (might already be removed):",
                        leaveError
                    );
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
