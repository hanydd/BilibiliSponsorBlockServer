import { Logger } from "../utils/logger";
import { config } from "../config";
import DownvoteSegmentArchiveJob from "./downvoteSegmentArchiveJob";
import refreshTopUserViewJob from "./refreshTopUserView";

export function startAllCrons(): void {
    if (config?.crons?.enabled) {
        Logger.info("Crons started");

        refreshTopUserViewJob.start();
    } else {
        Logger.info("Crons dissabled");
    }
}
