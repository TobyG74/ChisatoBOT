import { Database } from "..";
import { Chisato } from "../../types/client";
import { GroupSetting as GroupSettingType } from "@prisma/client";

export class GroupSetting {
    /**
     * Add Group Metadata to Database
     * @param Chisato
     * @param groupId
     * @returns {Promise<GroupSettingType>}
     */
    public upsert = (Chisato: Chisato, groupId: string): Promise<GroupSettingType> =>
        new Promise(async (resolve, reject) => {
            try {
                if (await this.get(groupId)) return;
                const metadata = await Database.groupSetting.upsert({
                    where: { groupId },
                    create: {
                        groupId,
                        antilink: {
                            status: false,
                            list: ["whatsapp"],
                            mode: "delete",
                        },
                    },
                    update: {},
                });
                Chisato.log("info", `Added New Group Setting ${groupId}`);
                resolve(metadata);
            } catch (err) {
                reject(err);
            }
        });

    /**
     * Get Group Metadata from Database
     * @param groupId
     * @returns {Promise<GroupSettingType>}
     */
    public get = (groupId: string): Promise<GroupSettingType> =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.groupSetting.findUnique({
                    where: { groupId },
                });
                resolve(metadata);
            } catch (err) {
                reject(err);
            }
        });

    /**
     * Update Group Metadata from Database
     * @param groupId
     * @param data
     * @returns {Promise<GroupSettingType>}
     */
    public update = (groupId: string, data: any): Promise<GroupSettingType> =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.groupSetting.update({
                    where: { groupId },
                    data: { ...data },
                });
                resolve(metadata);
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
                const metadata = await Database.groupSetting.delete({
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
    public size = () =>
        new Promise(async (resolve, reject) => {
            try {
                const group = await Database.groupSetting.count();
                resolve(group);
            } catch (err) {
                reject(err);
            }
        });
}
