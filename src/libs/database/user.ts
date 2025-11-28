import { Client, Database } from "..";
import { User as UserType } from "@prisma/client";
import fs from "fs";

export class User {
    public config: Config = JSON.parse(
        fs.readFileSync("./config.json", "utf-8")
    );
    /**
     * Add User Data to Database
     * @param Chisato
     * @param userId
     * @returns {Promise<UserType>}
     */
    public upsert = (
        Chisato: Client,
        userId: string,
        pushName: string
    ): Promise<UserType> =>
        new Promise(async (resolve, reject) => {
            try {
                if (await this.get(userId, pushName)) return;
                const isTeam = this.config.teamNumber.includes(
                    userId.split("@")[0]
                );
                if (!userId) return;
                const metadata = await Database.user.upsert({
                    where: { userId },
                    create: {
                        userId,
                        limit: isTeam ? 0 : this.config.limit.command,
                        role: isTeam ? "premium" : "free",
                        afk: {
                            status: false,
                            reason: "",
                            since: 0,
                        },
                    },
                    update: {
                        userId,
                        limit: isTeam ? 0 : this.config.limit.command,
                        role: isTeam ? "premium" : "free",
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
     * Get User Data from Database
     * @param userId
     * @returns {Promise<UserType>}
     */
    public get = (
        userId: string,
        pushName?: string
    ): Promise<UserType | null> =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.user.findUnique({
                    where: { userId },
                });
                if (metadata?.name !== pushName && pushName)
                    await this.update(userId, { name: pushName });
                resolve(metadata);
            } catch (err) {
                resolve(null);
            }
        });

    /**
     * Get All User Data from Database
     * @returns {Promise<UserType[]>}
     */
    public getAll = (): Promise<UserType[]> =>
        new Promise(async (resolve, reject) => {
            try {
                const metadata = await Database.user.findMany();
                resolve(metadata);
            } catch (err) {
                resolve([]);
            }
        });

    /**
     * Update User Data from Database
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
     * Delete User Data from Database
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
    public size = (): Promise<number> =>
        new Promise(async (resolve, reject) => {
            try {
                const user = await Database.user.count();
                resolve(user);
            } catch (err) {
                reject(err);
            }
        });
}
