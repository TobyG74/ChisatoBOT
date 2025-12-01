import { Client, Database } from "..";
import { Group as GroupType, Settings } from "@prisma/client";
import { databaseService } from "../../infrastructure/database/database.service";

export class Group {
    /**
     * Add Group Metadata to Database
     * @param Chisato
     * @param groupId
     * @returns {Promise<GroupType>}
     */
    public upsert = (
        Chisato: Client,
        groupId: string
    ): Promise<GroupType | null> =>
        new Promise(async (resolve, reject) => {
            try {
                const existing = await this.get(groupId);
                if (existing) {
                    resolve(existing);
                    return;
                }
                const groupData = await Chisato.groupMetadata?.(groupId).catch(
                    () => void 0
                );
                if (!groupData) {
                    resolve(null);
                    return;
                }

                const excludeFields = [
                    "id",
                    "subjectOwner",
                    "subjectTime",
                    "descId",
                    "inviteCode",
                    "author",
                    "settings",
                    "addressingMode",
                    "subjectOwnerPn",
                    "ownerPn",
                    "descOwner",
                    "descOwnerPn",
                    "descTime",
                    "linkedParent",
                    "notify",
                    "owner_country_code",
                ];

                for (const key of Object.keys(groupData)) {
                    if (excludeFields.includes(key)) {
                        delete (groupData as any)[key];
                    }
                }

                (groupData as any).ephemeralDuration =
                    (groupData as any).ephemeralDuration || 0;
                const metadata = await Database.group.upsert({
                    where: { groupId },
                    create: {
                        groupId,
                        ...(groupData as any),
                    },
                    update: { groupId, ...(groupData as any) },
                    include: {
                        settings: true,
                    },
                });
                Chisato.log("info", `Added New Group Metadata ${groupId}`);
                resolve(metadata);
            } catch (err) {
                reject(err);
            }
        });

    /**
     * Get Group Metadata from Database
     * @param groupId
     * @returns {Promise<GroupType>}
     */
    public get = (groupId: string): Promise<GroupType | null> =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.group.findUnique({
                    where: { groupId },
                });
                resolve(metadata);
            } catch (err) {
                resolve(null);
            }
        });

    /**
     * Get All Group Metadata from Database
     * @returns {Promise<GroupType[]>}
     */
    public getAll = (): Promise<GroupType[]> =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.group.findMany();
                resolve(metadata);
            } catch (err) {
                reject(err);
            }
        });

    /**
     * Get Group Settings from Database
     * @param groupId
     * @returns {Promise<Settings>}
     */
    public getSettings = (groupId: string): Promise<Settings> =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.group.findUnique({
                    where: { groupId },
                    select: {
                        settings: true,
                    },
                });
                if (!metadata || !metadata.settings) {
                    reject(new Error("Group settings not found"));
                    return;
                }
                resolve(metadata.settings);
            } catch (err) {
                reject(err);
            }
        });

    /**
     * Update Group Metadata from Database
     * @param groupId
     * @param data
     * @returns {Promise<GroupType>}
     */
    public update = (groupId: string, data: any): Promise<GroupType> =>
        new Promise(async (resolve, reject) => {
            try {
                // Use databaseService to ensure cache is invalidated
                const metadata = await databaseService.updateGroup(groupId, data);
                resolve(metadata);
            } catch (err) {
                reject(err);
            }
        });

    /**
     * Update Group Settings from Database
     * @param groupId
     * @param data {Settings}
     * @returns {Promise<Settings>}
     */
    public updateSettings = (groupId: string, data: any): Promise<Settings> =>
        new Promise(async (resolve, reject) => {
            try {
                // Use databaseService to ensure cache is invalidated
                const metadata = await databaseService.updateGroupSettings(groupId, data);
                resolve(metadata.settings);
            } catch (err) {
                reject(err);
            }
        });

    /**
     * Delete Group Metadata from Database
     * @param groupId
     * @returns
     */
    public delete = (groupId: string) =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.group.delete({
                    where: { groupId },
                });
                resolve(metadata);
            } catch (err) {
                reject(err);
            }
        });

    /**
     * View the count of Database
     * @returns {number}
     */
    public size = (): Promise<number> =>
        new Promise(async (resolve, reject) => {
            try {
                const group = await Database.group.count();
                resolve(group);
            } catch (err) {
                reject(err);
            }
        });
}
