import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "syncdatabase",
    alias: ["syncdb"],
    category: "owner",
    description: "Sync Database",
    isTeam: true,
    async run({ Chisato, from, message, Database }) {
        const groupDatabase = Database.Group.getAll();
        const groupDatabaseIDs = (await groupDatabase).map((v) => v.groupId);
        const groupFetch = await Chisato.groupFetchAllParticipating();
        const groupFetchIDs = Object.keys(groupFetch);
        await Chisato.sendText(from, `Sync Database Started!\nTotal Group: ${groupDatabaseIDs.length}`);
        for (let i = 0; i < groupDatabaseIDs.length; i++) {
            if (groupFetchIDs.includes(groupDatabaseIDs[i])) {
                const groupMetadata = groupFetch[groupDatabaseIDs[i]];
                delete groupMetadata.id;
                delete groupMetadata.subjectOwner;
                delete groupMetadata.subjectTime;
                delete groupMetadata.descId;
                const groupSettingsData = await Database.Group.getSettings(groupDatabaseIDs[i]);
                groupMetadata.ephemeralDuration = groupMetadata.ephemeralDuration || 0;
                9;
                await Database.Group.update(groupDatabaseIDs[i], {
                    groupMetadata,
                }).catch(async () => {
                    await Database.Group.delete(groupDatabaseIDs[i]);
                    await Database.Group.upsert(Chisato, groupDatabaseIDs[i]);
                });
            } else {
                await Database.Group.delete(groupDatabaseIDs[i]);
            }
        }
        const groupDatabaseAfter = Database.Group.getAll();
        Chisato.sendText(
            from,
            `Sync Database Done!\nTotal Group: ${(await groupDatabaseAfter).length}\nTotal Group Deleted: ${
                (await groupDatabase).length - (await groupDatabaseAfter).length
            }`
        );
    },
} satisfies ConfigCommands;