import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "syncdatabase",
    alias: ["syncdb"],
    category: "owner",
    description: "Sync Database",
    isTeam: true,
    async run({ Chisato, from, message, Database }) {
        const groupDatabase = await Database.Group.getAll();
        const groupDatabaseIDs = groupDatabase.map((v) => v.groupId);
        const groupFetch = await Chisato.groupFetchAllParticipating();
        const groupFetchIDs = Object.keys(groupFetch);

        await Chisato.sendText(
            from,
            `Sync Database Started!\nTotal Group: ${groupDatabaseIDs.length}`,
            message
        );

        // Track per-group outcomes so a single failure doesn't abort the whole
        // sync run and we can show a useful summary at the end.
        let updated = 0;
        let removed = 0;
        let failed = 0;

        for (const groupId of groupDatabaseIDs) {
            try {
                if (groupFetchIDs.includes(groupId)) {
                    // Bot is still in this group → refresh stored metadata.
                    const groupMetadata: any = { ...groupFetch[groupId] };
                    delete groupMetadata.id;
                    delete groupMetadata.subjectOwner;
                    delete groupMetadata.subjectTime;
                    delete groupMetadata.descId;
                    groupMetadata.ephemeralDuration = groupMetadata.ephemeralDuration || 0;

                    try {
                        await Database.Group.update(groupId, { groupMetadata });
                    } catch {
                        // Update failed (e.g. row corrupted) → recreate cleanly.
                        await Database.Group.delete(groupId);
                        await Database.Group.upsert(Chisato, groupId);
                    }
                    updated++;
                } else {
                    // Bot no longer in group → drop the row. delete() is
                    // idempotent (uses deleteMany under the hood) so a
                    // race where the row vanished mid-sync is harmless.
                    await Database.Group.delete(groupId);
                    removed++;
                }
            } catch (err) {
                failed++;
                Chisato.logger?.error?.(
                    `syncdb: failed to process ${groupId}: ${
                        err instanceof Error ? err.message : String(err)
                    }`
                );
            }
        }

        const groupDatabaseAfter = await Database.Group.getAll();
        await Chisato.sendText(
            from,
            `Sync Database Done!\n` +
            `Total Group: ${groupDatabaseAfter.length}\n` +
            `Updated: ${updated}\n` +
            `Deleted: ${removed}\n` +
            `Failed:  ${failed}`,
            message
        );
    },
} satisfies ConfigCommands;
