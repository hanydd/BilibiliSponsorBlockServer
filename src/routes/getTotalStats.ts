import axios from "axios";
import { Request, Response } from "express";
import { config } from "../config";
import { db } from "../databases/databases";
import { Logger } from "../utils/logger";

// A cache of the number of chrome web store users
let chromeUsersCache = 0;
let firefoxUsersCache = 0;
let egdeUserCache = 0;

// By the privacy friendly user counter
let apiUsersCache = 0;
let lastUserCountCheck = 0;

interface DBStatsData {
    userCount: number;
    viewCount: number;
    totalSubmissions: number;
    minutesSaved: number;
}

let lastFetch: DBStatsData = {
    userCount: 0,
    viewCount: 0,
    totalSubmissions: 0,
    minutesSaved: 0,
};

updateExtensionUsers();

export async function getTotalStats(req: Request, res: Response): Promise<void> {
    try {
        const countContributingUsers = Boolean(req.query?.countContributingUsers == "true");
        const row = await getStats(countContributingUsers);
        lastFetch = row;

        /* istanbul ignore if */
        if (!row) res.sendStatus(500);
        const extensionUsers = chromeUsersCache + firefoxUsersCache + egdeUserCache;

        //send this result
        res.send({
            userCount: row.userCount ?? 0,
            activeUsers: extensionUsers,
            apiUsers: Math.max(apiUsersCache, extensionUsers),
            viewCount: row.viewCount,
            totalSubmissions: row.totalSubmissions,
            minutesSaved: Math.round(row.minutesSaved),
        });

        // Check if the cache should be updated (every ~14 hours)
        const now = Date.now();
        if (now - lastUserCountCheck > 5000000) {
            lastUserCountCheck = now;

            updateExtensionUsers();
        }
    } catch (e) {
        Logger.error(e as string);
        res.sendStatus(500);
    }
}

function getStats(countContributingUsers: boolean): Promise<DBStatsData> {
    if (db.highLoad()) {
        return Promise.resolve(lastFetch);
    } else {
        const userCountQuery = `(SELECT COUNT(*) FROM (SELECT DISTINCT "userID" from "sponsorTimes") t) "userCount",`;

        return db.prepare(
            "get",
            `SELECT ${countContributingUsers ? userCountQuery : ""} COUNT(*) as "totalSubmissions",
            SUM("views") as "viewCount", SUM(("endTime" - "startTime") / 60 * "views") as "minutesSaved" FROM "sponsorTimes" WHERE "shadowHidden" != 1 AND "votes" >= 0 AND "actionType" != 'chapter'`,
            []
        );
    }
}

function updateExtensionUsers() {
    if (config.userCounterURL) {
        axios
            .get(`${config.userCounterURL}/api/v1/userCount`)
            .then((res) => (apiUsersCache = Math.max(apiUsersCache, res.data.userCount)))
            .catch(() => Logger.debug(`Failing to connect to user counter at: ${config.userCounterURL}`));
    }

    const mozillaAddonsUrl = "https://addons.mozilla.org/api/v5/addons/addon/bilisponsorblock/";
    const edgeExtId = "khkeolgobhdoloioehjgfpobjnmagfha";
    const chromeExtId = "eaoelafamejbnggahofapllmfhlhajdd";

    axios
        .get(mozillaAddonsUrl)
        .then((res) => (firefoxUsersCache = res.data.average_daily_users))
        .catch(() => {
            Logger.error(`Failing to connect to ${mozillaAddonsUrl}`);
            return 0;
        });

    getChromeUsers(chromeExtId)
        .then((res) => (chromeUsersCache = res))
        .catch((err) => {
            Logger.error(`Error getting Chrome users - ${err}`);
        });

    getEdgeUsers(edgeExtId)
        .then((res) => (egdeUserCache = res))
        .catch((err) => {
            Logger.error(`Error getting Edge users - ${err}`);
        });
}

async function getEdgeUsers(extID: string): Promise<number | undefined> {
    try {
        const res = await axios.get(`https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${extID}`);
        return res.data.activeInstallCount;
    } catch (err) {
        Logger.error(`Error getting Edge users - ${err}`);
        return 0;
    }
}

const chromeUserRegex = /<title>users: (([\d,]+?)|([\d,]+?k))<\/title>/;
export function getChromeUsers(extID: string): Promise<number | undefined> {
    return axios
        .get(`https://img.shields.io/chrome-web-store/users/${extID}`)
        .then((res) => {
            const match = res.data.match(chromeUserRegex);
            if (match && match[2]) {
                return parseInt(match[2].replace(/,/g, ""));
            } else if (match && match[3]) {
                return parseInt(match[3].replace(/,|k/g, "")) * 1000;
            }
        })
        .catch(() => {
            Logger.error(`Failing to get user count of the Chrome Web Store: ${extID}`);
            return 0;
        });
}
