import { Participant } from "@prisma/client";
import { Chisato } from "./client";
import { Group, GroupSetting, User } from "./database";
import { MessageSerialize } from "./serialize";

declare type ConfigCommands = {
    name: string;
    alias: string[];
    usage: string;
    category: string;
    description: string;
    cooldown?: number; // in seconds
    limit?: number;
    example?: string;
    isOwner?: boolean;
    isTeam?: boolean;
    isPrivate?: boolean;
    isPremium?: boolean;
    isGroup?: boolean;
    isGroupAdmin?: boolean;
    isGroupOwner?: boolean;
    isBotAdmin?: boolean;
    isProcess?: boolean;
    run: (args: CommandsObject) => unknown;
};

type CommandsObject = {
    Chisato?: Chisato;
    from?: string;
    sender?: string;
    args?: string[];
    arg?: string;
    query?: string;
    body?: string;
    prefix?: string;
    command?: ConfigCommands;
    pushName?: string;
    message?: MessageSerialize;
    botNumber?: string;
    botName?: string;
    isOwner?: boolean;
    isTeam?: boolean;
    isGroup?: boolean;
    isGroupAdmin?: boolean;
    isGroupOwner?: boolean;
    isBotAdmin?: boolean;
    Database?: Database;
    groupName?: string;
    groupDescription?: string;
    groupParticipants?: Participant[];
    groupAdmins?: Participant[];
    groupMetadata?: Group;
    groupSettingData?: GroupSetting;
    userMetadata?: User;
};

declare type Database = {
    Group: Group;
    GroupSetting: GroupSetting;
    User: User;
};

declare type Commands = {
    cmd: ConfigCmd;
};

declare type ConfigEvents = {
    name: string;
    isGroup: booelean;
    isBotAdmin: boolean;
    run: (args: EventsObject) => unknown;
};

declare type EventsObject = {
    name?: string;
    time?: string;
    Chisato?: Chisato;
    from?: string;
    sender?: string;
    body?: string;
    prefix?: string;
    pushName?: string;
    message?: MessageSerialize;
    isOwner?: boolean;
    isGroup?: boolean;
    isGroupAdmin?: boolean;
    isGroupOwner?: boolean;
    isBotAdmin?: boolean;
    Database?: Database;
    groupName?: string;
};
