import { Client } from "./client";

let clientInstance: Client | null = null;

export function setClientInstance(client: Client): void {
    clientInstance = client;
}

export function getClientInstance(): Client | null {
    return clientInstance;
}
