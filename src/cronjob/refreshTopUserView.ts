import { CronJob } from "cron";
import { db } from "../databases/databases";
import { QueryCacher } from "../utils/queryCacher";

export async function refreshTopUserView() {
    await db.prepare("run", `REFRESH MATERIALIZED VIEW "topUser"`);
    QueryCacher.clearTopUserCache();
}

const refreshTopUserViewJob = new CronJob("*/10 * * * *", () => void refreshTopUserView());

export default refreshTopUserViewJob;
