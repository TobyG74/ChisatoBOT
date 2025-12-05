import { databaseService } from "../../infrastructure/database/database.service";
import { configService } from "../../core/config/config.service";
import { logger } from "../../core/logger/logger.service";
import type { Client } from "../client/client";

export class User {
    /**
     * Add/Update User Data to Database
     * @deprecated Use databaseService.upsertUser instead
     */
    public upsert = async (
        Chisato: Client,
        userId: string,
        pushName: string
    ): Promise<any> => {
        try {
            const existing = await databaseService.getUser(userId);
            if (existing) return existing;

            const config = configService.getConfig();
            const isTeam = config.teamNumber.includes(userId.split("@")[0]);

            const user = await databaseService.upsertUser(userId, pushName);

            // Update role if team member
            if (isTeam) {
                await databaseService.updateUser(userId, {
                    role: "premium",
                    limit: 0,
                });
            }

            logger.info(`Added new user: ${userId}`);
            return user;
        } catch (error) {
            logger.error(
                `User upsert error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            throw error;
        }
    };

    /**
     * Get User Data from Database
     * @deprecated Use databaseService.getUser instead
     */
    public get = async (userId: string, pushName?: string): Promise<any> => {
        try {
            const user = await databaseService.getUser(userId);

            if (user && pushName && user.name !== pushName) {
                await databaseService.updateUser(userId, { name: pushName });
            }

            return user;
        } catch (error) {
            return null;
        }
    };

    /**
     * Update User Data from Database
     * @deprecated Use databaseService.updateUser instead
     */
    public update = async (userId: string, data: any): Promise<any> => {
        try {
            return await databaseService.updateUser(userId, data);
        } catch (error) {
            logger.error(
                `User update error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            throw error;
        }
    };

    /**
     * Delete User Data from Database
     * @deprecated Use databaseService directly
     */
    public delete = async (userId: string): Promise<any> => {
        try {
            const prisma = databaseService.getPrismaClient();
            return await prisma.user.delete({ where: { userId } });
        } catch (error) {
            logger.error(
                `User delete error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            throw error;
        }
    };

    /**
     * View the count of Database
     * @deprecated Use databaseService.getUserCount instead
     */
    public size = async (): Promise<number> => {
        try {
            return await databaseService.getUserCount();
        } catch (error) {
            return 0;
        }
    };

    /**
     * Add XP to user and track command usage
     */
    public addXP = async (
        userId: string,
        xpToAdd: number,
        commandName: string
    ): Promise<any> => {
        try {
            return await databaseService.addUserXP(userId, xpToAdd, commandName);
        } catch (error) {
            logger.error(
                `Add XP error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            throw error;
        }
    };

    /**
     * Get all users for leaderboard
     */
    public getAll = async (): Promise<any[]> => {
        try {
            return await databaseService.getAllUsers();
        } catch (error) {
            return [];
        }
    };
}
