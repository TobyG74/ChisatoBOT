import { WACallEvent } from "baileys";
import { CallSerialize } from "../../types/serialize";

export const call = async (message: WACallEvent[]): Promise<CallSerialize> => {
    return {
        ...message[0],
    };
};
