import { CronJob } from "cron";
import { db } from "../databases/databases";
import { QueryCacher } from "../utils/queryCacher";

export async function refreshTopUserView() {
    // create view if not exists
    await createTopUserView();

    // refresh view data
    await db.prepare("run", `REFRESH MATERIALIZED VIEW "topUser"`);
    QueryCacher.clearTopUserCache();
}

const refreshTopUserViewJob = new CronJob("*/15 * * * *", () => void refreshTopUserView());

async function createTopUserView() {
    // create view
    await db.prepare(
        "run",
        `CREATE MATERIALIZED VIEW IF NOT EXISTS "topUser" AS (
SELECT
    COALESCE(sponsor."userName", port."userName") AS "userName",
    COALESCE(sponsor."totalSubmissions", 0) AS "totalSubmissions",
    COALESCE(sponsor."viewCount", 0) AS "viewCount",
    COALESCE(sponsor."minutesSaved", 0) AS "minutesSaved",
    (COALESCE(sponsor."userVotes", 0) + COALESCE(port."userVotes", 0)) AS "userVotes",
    COALESCE(port."portVideoSubmissions", 0) AS "portVideoSubmissions",
    COALESCE(sponsor."categorySumSponsor", 0) AS "categorySumSponsor",
    COALESCE(sponsor."categorySumIntro", 0) AS "categorySumIntro",
    COALESCE(sponsor."categorySumOutro", 0) AS "categorySumOutro",
    COALESCE(sponsor."categorySumInteraction", 0) AS "categorySumInteraction",
    COALESCE(sponsor."categorySumSelfpromo", 0) AS "categorySumSelfpromo",
    COALESCE(sponsor."categorySumMusicOfftopic", 0) AS "categorySumMusicOfftopic",
    COALESCE(sponsor."categorySumPreview", 0) AS "categorySumPreview",
    COALESCE(sponsor."categorySumHighlight", 0) AS "categorySumHighlight",
    COALESCE(sponsor."categorySumFiller", 0) AS "categorySumFiller",
    COALESCE(sponsor."categorySumExclusiveAccess", 0) AS "categorySumExclusiveAccess"
FROM (
        SELECT count(*) AS "portVideoSubmissions",
            sum("portVideo".votes) AS "userVotes",
            COALESCE("userNames"."userName", "portVideo"."userID") AS "userName"
        FROM "portVideo"
            LEFT JOIN "userNames" ON ("portVideo"."userID" = "userNames"."userID")
            LEFT JOIN "shadowBannedUsers" ON ("portVideo"."userID" = "shadowBannedUsers"."userID")
        WHERE "portVideo".votes > -2 AND "portVideo".hidden = 0 AND "shadowBannedUsers"."userID" IS NULL
        GROUP BY COALESCE("userNames"."userName", "portVideo"."userID")
    ) port
    FULL JOIN
    (
        SELECT
            count(*) AS "totalSubmissions",
            sum("sponsorTimes".views) AS "viewCount",
            sum(("sponsorTimes"."endTime" - "sponsorTimes"."startTime") / 60 * "sponsorTimes".views) AS "minutesSaved",
            sum("sponsorTimes".votes) AS "userVotes",
            sum(CASE WHEN ("sponsorTimes".category = 'sponsor') THEN 1 ELSE 0 END) AS "categorySumSponsor",
            sum(CASE WHEN ("sponsorTimes".category = 'intro') THEN 1 ELSE 0 END) AS "categorySumIntro",
            sum(CASE WHEN ("sponsorTimes".category = 'outro') THEN 1 ELSE 0 END) AS "categorySumOutro",
            sum(CASE WHEN ("sponsorTimes".category = 'interaction') THEN 1 ELSE 0 END) AS "categorySumInteraction",
            sum(CASE WHEN ("sponsorTimes".category = 'selfpromo') THEN 1 ELSE 0 END) AS "categorySumSelfpromo",
            sum(CASE WHEN ("sponsorTimes".category = 'music_offtopic') THEN 1 ELSE 0 END) AS "categorySumMusicOfftopic",
            sum(CASE WHEN ("sponsorTimes".category = 'preview') THEN 1 ELSE 0 END) AS "categorySumPreview",
            sum(CASE WHEN ("sponsorTimes".category = 'poi_highlight') THEN 1 ELSE 0 END) AS "categorySumHighlight",
            sum(CASE WHEN ("sponsorTimes".category = 'filler') THEN 1 ELSE 0 END) AS "categorySumFiller",
            sum(CASE WHEN ( "sponsorTimes".category = 'exclusive_access') THEN 1 ELSE 0 END) AS "categorySumExclusiveAccess",
            COALESCE("userNames"."userName", "sponsorTimes"."userID") AS "userName"
        FROM "sponsorTimes"
            LEFT JOIN "userNames" ON ("sponsorTimes"."userID" = "userNames"."userID")
            LEFT JOIN "shadowBannedUsers" ON ("sponsorTimes"."userID" = "shadowBannedUsers"."userID")
        WHERE "sponsorTimes".votes > -2 AND "sponsorTimes"."shadowHidden" <> 1 AND "shadowBannedUsers"."userID" IS NULL
        GROUP BY COALESCE("userNames"."userName", "sponsorTimes"."userID")
    ) sponsor
    ON ((port."userName" = sponsor."userName"))
)`
    );
}

export default refreshTopUserViewJob;
