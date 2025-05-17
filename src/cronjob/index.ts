import { config } from "../config";
import { Logger } from "../utils/logger";
import { dumpDatabaseJob } from "./dumpDatabase";
import { refreshCidJob } from "./refreshCid";
import refreshTopUserViewJob from "./refreshTopUserView";

export function startAllCrons(): void {
    if (config?.crons?.enabled) {
        Logger.info("Crons started");

        refreshTopUserViewJob.start();

        if (config.mode === "production") {
            // only run in production mode
            dumpDatabaseJob.start();
            refreshCidJob.start();
        }
    } else {
        Logger.info("Crons dissabled");
    }
}
