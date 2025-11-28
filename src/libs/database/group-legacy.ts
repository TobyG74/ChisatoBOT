import { databaseService } from "../../infrastructure/database/database.service";
import { logger } from "../../core/logger/logger.service";
import type { Client } from "../client/client";

export class Group {
    /**
     * Add Group Metadata to Database
     * @deprecated Use databaseService.upsertGroup instead
     */
    public upsert = async (Chisato: Client, groupId: string): Promise<any> => {
        try {
            const existing = await databaseService.getGroup(groupId);
            if (existing) return existing;

            if (!Chisato.groupMetadata) return null;
            const groupData = await Chisato.groupMetadata(groupId).catch(
                () => null
            );
            if (!groupData) return null;

            const group = await databaseService.upsertGroup(groupId, groupData);
            logger.info(`Added new group: ${groupId}`);
            return group;
        } catch (error) {
            logger.error(
                `Group upsert error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            throw error;
        }
    };

    /**
     * Get Group Metadata from Database
     * @deprecated Use databaseService.getGroup instead
     */
    public get = async (groupId: string): Promise<any> => {
        try {
            return await databaseService.getGroup(groupId);
        } catch (error) {
            return null;
        }
    };

    /**
     * Get All Group Metadata from Database
     * @deprecated Use databaseService.getAllGroups instead
     */
    public getAll = async (): Promise<any[]> => {
        try {
            return await databaseService.getAllGroups();
        } catch (error) {
            return [];
        }
    };

    /**
     * Get Group Settings from Database
     * @deprecated Use databaseService.getGroup and access .settings instead
     */
    public getSettings = async (groupId: string): Promise<any> => {
        try {
            const group = await databaseService.getGroup(groupId);
            return group?.settings || null;
        } catch (error) {
            return null;
        }
    };

    /**
     * Update Group Metadata from Database
     * @deprecated Use databaseService.updateGroup instead
     */
    public update = async (groupId: string, data: any): Promise<any> => {
        try {
            return await databaseService.updateGroup(groupId, data);
        } catch (error) {
            logger.error(
                `Group update error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            throw error;
        }
    };

    /**
     * Update Group Settings from Database
     * @deprecated Use databaseService.updateGroupSettings instead
     */
    public updateSettings = async (
        groupId: string,
        data: any
    ): Promise<any> => {
        try {
            const group = await databaseService.updateGroupSettings(
                groupId,
                data
            );
            return group?.settings || null;
        } catch (error) {
            logger.error(
                `Group settings update error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            throw error;
        }
    };

    /**
     * Delete Group Metadata from Database
     * @deprecated Use databaseService.deleteGroup instead
     */
    public delete = async (groupId: string): Promise<any> => {
        try {
            return await databaseService.deleteGroup(groupId);
        } catch (error) {
            logger.error(
                `Group delete error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            throw error;
        }
    };

    /**
     * View the count of Database
     * @deprecated Use databaseService.getGroupCount instead
     */
    public size = async (): Promise<number> => {
        try {
            return await databaseService.getGroupCount();
        } catch (error) {
            return 0;
        }
    };
}
