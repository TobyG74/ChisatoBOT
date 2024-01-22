import { Database } from "..";
import { Chisato } from "../../types/client";
import { User as UserType } from "@prisma/client";

export class User {
    /**
     * Add Group Metadata to Database
     * @param Chisato
     * @param userId
     * @returns {Promise<UserType>}
     */
    public upsert = (Chisato: Chisato, userId: string): Promise<UserType> =>
        new Promise(async (resolve, reject) => {
            try {
                if (await this.get(userId)) return;
                const isOwner = Chisato.config.ownerNumber.includes(userId.split("@")[0]);
                const metadata = await Database.user.upsert({
                    where: { userId },
                    create: {
                        userId,
                        limit: isOwner ? 0 : Chisato.config.limit.command,
                        role: "free",
                        afk: {
                            status: false,
                            reason: "",
                            since: 0,
                        },
                    },
                    update: {
                        userId,
                        limit: isOwner ? 0 : Chisato.config.limit.command,
                        role: "free",
                        afk: {
                            status: false,
                            reason: "",
                            since: 0,
                        },
                    },
                });
                Chisato.log("info", `Added New User ${userId}`);
                resolve(metadata);
            } catch (err) {
                reject(err);
            }
        });

    /**
     * Get Group Metadata from Database
     * @param userId
     * @returns {Promise<UserType>}
     */
    public get = (userId: string): Promise<UserType> =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.user.findUnique({
                    where: { userId },
                });
                resolve(metadata);
            } catch (err) {
                resolve(null);
            }
        });

    /**
     * Update Group Metadata from Database
     * @param userId
     * @param data
     * @returns {Promise<UserType>}
     */
    public update = (userId: string, data: any): Promise<UserType> =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.user.update({
                    where: { userId },
                    data: { ...data },
                });
                resolve(metadata);
            } catch (err) {
                reject(err);
            }
        });

    /**
     * Delete Group Metadata from Database
     * @param userId
     * @returns
     */
    public delete = (userId: string) =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.user.delete({
                    where: { userId },
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
                const group = await Database.user.count();
                resolve(group);
            } catch (err) {
                reject(err);
            }
        });

    public afk = (userId: string, data: any) =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.user.update({
                    where: { userId },
                    data: { ...data },
                });
                resolve(metadata);
            } catch (err) {
                reject(err);
            }
        });
}
