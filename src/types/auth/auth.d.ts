import { AuthenticationState } from "baileys";

declare type AuthState = {
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
    clearState: () => Promise<void>;
};
