import { config } from "../config";
import { Logger } from "../utils/logger";
import { dumpDatebaseJob } from "./dumpDatabase";
import refreshTopUserViewJob from "./refreshTopUserView";

export function startAllCrons(): void {
    if (config?.crons?.enabled) {
        Logger.info("Crons started");

        refreshTopUserViewJob.start();
        dumpDatebaseJob.start();
    } else {
        Logger.info("Crons dissabled");
    }
}
