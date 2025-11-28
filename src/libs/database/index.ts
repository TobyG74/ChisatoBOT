// New optimized database service (recommended)
export {
    databaseService,
    Database,
} from "../../infrastructure/database/database.service";

// Legacy classes for backward compatibility (deprecated)
export { User } from "./user-legacy";
export { Group } from "./group-legacy";
