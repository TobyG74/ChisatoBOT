import { ConfigCommands, ConfigSettings } from "../../types/structure/commands";

export const commands = new Map<string, ConfigCommands>();

export const settings = new Map<string, ConfigSettings>();

export const cooldowns = new Map<string, number>();
