import { ConfigCommands, ConfigEvents } from "../../types/commands";

export const commands = new Map<string, ConfigCommands>();

export const events = new Map<string, ConfigEvents>();

export const cooldowns = new Map<string, number>();
