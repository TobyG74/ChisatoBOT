import type { AuthenticationState } from "@whiskeysockets/baileys";

declare type AuthState = {
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
    clearState: () => Promise<void>;
};
