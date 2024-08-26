import { CronJob } from "cron";
import { db } from "../databases/databases";

export async function refreshTopUserView() {
    await db.prepare("run", `REFRESH MATERIALIZED VIEW "topUser"`);
}

const refreshTopUserViewJob = new CronJob("*/10 * * * *", () => void refreshTopUserView());

export default refreshTopUserViewJob;
