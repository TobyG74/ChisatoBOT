import type { PrismaClient } from "@prisma/client";
import makeWASocket, { AuthenticationCreds, SignalDataTypeMap, proto, BufferJSON, initAuthCreds } from "baileys";
import type { AuthState } from "../types/auth/auth";

export const useMultiAuthState = async (
    Database: PrismaClient
): Promise<AuthState> => {
    const fixFileName = (fileName: string): string =>
        fileName.replace(/\//g, "__")?.replace(/:/g, "-");

    // In-memory cache: prevents repeated DB reads for the same key within a
    // session and ensures freshly-written keys are immediately visible, which
    // avoids Signal treating them as missing and requesting new prekey bundles.
    const keyCache = new Map<string, unknown>();

    const writeData = async (data: unknown, fileName: string) => {
        try {
            const sessionId = fixFileName(fileName);
            const session = JSON.stringify(data, BufferJSON.replacer);
            await Database.session.upsert({
                where: { sessionId },
                update: { sessionId, session },
                create: { sessionId, session },
            });
        } catch {}
    };

    const readData = async (fileName: string): Promise<unknown> => {
        const cacheKey = fixFileName(fileName);
        // Serve from in-memory cache when available
        if (keyCache.has(cacheKey)) {
            return keyCache.get(cacheKey);
        }
        try {
            const data = await Database.session.findFirst({
                where: { sessionId: cacheKey },
            });
            if (!data?.session) return null;
            const parsed = JSON.parse(data.session, BufferJSON.reviver);
            keyCache.set(cacheKey, parsed);
            return parsed;
        } catch {
            return null;
        }
    };

    const removeData = async (fileName: string): Promise<void> => {
        keyCache.delete(fixFileName(fileName));
        try {
            const sessionId = fixFileName(fileName);
            await Database.session.delete({ where: { sessionId } });
        } catch {}
    };

    const creds: AuthenticationCreds =
        ((await readData("creds")) as AuthenticationCreds) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: {
                        [_: string]: SignalDataTypeMap[typeof type];
                    } = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === "app-state-sync-key" && value)
                                value =
                                    proto.Message.AppStateSyncKeyData.fromObject(
                                        value
                                    );
                            if (value !== undefined && value !== null)
                                data[id] = value as SignalDataTypeMap[typeof type];
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value: unknown = data[category][id];
                            const file = `${category}-${id}`;
                            const cacheKey = fixFileName(file);
                            // Update in-memory cache immediately so the next
                            // keys.get sees the value without waiting for DB.
                            if (value) {
                                keyCache.set(cacheKey, value);
                            } else {
                                keyCache.delete(cacheKey);
                            }
                            tasks.push(
                                value ? writeData(value, file) : removeData(file)
                            );
                        }
                    }
                    // Fire-and-forget: in-memory keyCache is already updated above
                    Promise.allSettled(tasks).catch(() => {});
                },
            },
        },
        saveCreds: async (): Promise<void> => {
            try {
                keyCache.set(fixFileName("creds"), creds);
                await writeData(creds, "creds");
            } catch {}
        },
        clearState: async (): Promise<void> => {
            try {
                keyCache.clear();
                await Database.session.deleteMany({});
            } catch {}
        },
    };
};

export const useSingleAuthState = async (
    Database: PrismaClient
): Promise<AuthState> => {
    const KEY_MAP: { [T in keyof SignalDataTypeMap]: string } = {
        "identity-key": "identityKeys",
        "pre-key": "preKeys",
        session: "sessions",
        "sender-key": "senderKeys",
        "app-state-sync-key": "appStateSyncKeys",
        "app-state-sync-version": "appStateVersions",
        "sender-key-memory": "senderKeyMemory",
        "device-list": "deviceLists",
        "lid-mapping": "lidMappings",
        "tctoken": "tcTokens",
    };

    let creds: AuthenticationCreds;
    let keys: unknown = {};

    const storedCreds = await Database.session.findFirst({
        where: {
            sessionId: "creds",
        },
    });
    if (storedCreds && storedCreds.session) {
        const parsedCreds = JSON.parse(storedCreds.session, BufferJSON.reviver);
        creds = parsedCreds.creds as AuthenticationCreds;
        keys = parsedCreds.keys;
    } else {
        if (!storedCreds)
            await Database.session.create({
                data: {
                    sessionId: "creds",
                },
            });
        creds = initAuthCreds();
    }

    const saveCreds = async (): Promise<void> => {
        try {
            const session = JSON.stringify(
                { creds, keys },
                BufferJSON.replacer
            );
            await Database.session.update({
                where: { sessionId: "creds" },
                data: { session },
            });
        } catch {}
    };

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const key = KEY_MAP[type];
                    return ids.reduce((dict: unknown, id) => {
                        const value: unknown = keys[key]?.[id];
                        if (value) {
                            if (type === "app-state-sync-key")
                                dict[id] =
                                    proto.Message.AppStateSyncKeyData.fromObject(
                                        value
                                    );
                            dict[id] = value;
                        }
                        return dict;
                    }, {});
                },
                set: async (data) => {
                    for (const _key in data) {
                        const key = (KEY_MAP as Record<string, string>)[_key];
                        keys[key] = keys[key] || {};
                        Object.assign(keys[key], data[_key]);
                    }
                    try {
                        await saveCreds();
                    } catch {}
                },
            },
        },
        saveCreds,
        clearState: async (): Promise<void> => {
            try {
                await Database.session.delete({
                    where: { sessionId: "creds" },
                });
            } catch {}
        },
    };
};
