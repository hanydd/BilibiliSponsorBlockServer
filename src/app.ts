import express, { RequestHandler, Router } from "express";
import ExpressPromiseRouter from "express-promise-router";
import { Server } from "http";
import { config } from "./config";
import { apiCspMiddleware } from "./middleware/apiCsp";
import { corsMiddleware } from "./middleware/cors";
import { cacheMiddlware } from "./middleware/etag";
import { hostHeader } from "./middleware/hostHeader";
import { loggerMiddleware } from "./middleware/logger";
import { rateLimitMiddleware } from "./middleware/requestRateLimit";
import { userCounter } from "./middleware/userCounter";
import { addUserAsTempVIP } from "./routes/addUserAsTempVIP";
import { addUserAsVIP } from "./routes/addUserAsVIP";
import { deleteLockCategoriesEndpoint } from "./routes/deleteLockCategories";
import { addFeature, getFeatureFlag } from "./routes/feature";
import { getDaysSavedFormatted } from "./routes/getDaysSavedFormatted";
import { getIsUserVIP } from "./routes/getIsUserVIP";
import { getLockCategories } from "./routes/getLockCategories";
import { getLockCategoriesByHash } from "./routes/getLockCategoriesByHash";
import { getLockReason } from "./routes/getLockReason";
import { getPortVideo, getPortVideoByHash, updatePortedSegments } from "./routes/getPortVideo";
import { getReady } from "./routes/getReady";
import { getSavedTimeForUser } from "./routes/getSavedTimeForUser";
import { endpoint as getSearchSegments } from "./routes/getSearchSegments";
import { endpoint as getSegmentInfo } from "./routes/getSegmentInfo";
import { getSkipSegments, getSkipSegmentsByHash } from "./routes/getSkipSegments";
import { getStatus } from "./routes/getStatus";
import { getTopCategoryUsers } from "./routes/getTopCategoryUsers";
import { getTopUsers } from "./routes/getTopUsers";
import { getTotalStats } from "./routes/getTotalStats";
import { getUserID } from "./routes/getUserID";
import { endpoint as getUserInfo } from "./routes/getUserInfo";
import { getUsername } from "./routes/getUsername";
import { getUserStats } from "./routes/getUserStats";
import { endpoint as getVideoLabels } from "./routes/getVideoLabel";
import { getVideoLabelsByHash } from "./routes/getVideoLabelByHash";
import { getViewsForUser } from "./routes/getViewsForUser";
import { postClearCache } from "./routes/postClearCache";
import { postLockCategories } from "./routes/postLockCategories";
import { postPortVideo } from "./routes/postPortVideo";
import { postPurgeAllSegments } from "./routes/postPurgeAllSegments";
import { postSegmentShift } from "./routes/postSegmentShift";
import { postSkipSegments } from "./routes/postSkipSegments";
import { postWarning } from "./routes/postWarning";
import { setUsername } from "./routes/setUsername";
import { shadowBanUser } from "./routes/shadowBanUser";
import { viewedVideoSponsorTime } from "./routes/viewedVideoSponsorTime";
import { voteOnPortVideo } from "./routes/voteOnPortVideo";
import { getUserID as voteGetUserID, voteOnSponsorTime } from "./routes/voteOnSponsorTime";

export function createServer(callback: () => void): Server {
    // Create a service (the app object is just a callback).
    const app = express();

    const router = ExpressPromiseRouter();
    app.use(router);
    app.set("etag", false); // disable built in etag

    //setup CORS correctly
    router.use(corsMiddleware);
    router.use(loggerMiddleware);
    router.use("/api/", apiCspMiddleware);
    router.use(hostHeader);
    router.use(cacheMiddlware);
    router.use(express.json());

    if (config.userCounterURL) router.use(userCounter);

    // Setup pretty JSON
    if (config.mode === "development") app.set("json spaces", 2);

    // Set production mode
    app.set("env", config.mode || "production");

    const server = app.listen(config.port, callback);

    setupRoutes(router, server);

    return server;
}

/* eslint-disable @typescript-eslint/no-misused-promises */
function setupRoutes(router: Router, server: Server) {
    // Rate limit endpoint lists
    const voteEndpoints: RequestHandler[] = [voteOnSponsorTime];
    const viewEndpoints: RequestHandler[] = [viewedVideoSponsorTime];
    if (config.rateLimit && config.redisRateLimit) {
        if (config.rateLimit.vote) voteEndpoints.unshift(rateLimitMiddleware(config.rateLimit.vote, voteGetUserID));
        if (config.rateLimit.view) viewEndpoints.unshift(rateLimitMiddleware(config.rateLimit.view));
    }

    //add the skip segments functions
    router.get("/api/skipSegments", getSkipSegments);
    router.post("/api/skipSegments", postSkipSegments);

    // add the privacy protecting skip segments functions
    router.get("/api/skipSegments/:prefix", getSkipSegmentsByHash);

    // get all segments that match a search
    router.get("/api/searchSegments", getSearchSegments);

    //voting endpoint
    router.get("/api/voteOnSponsorTime", ...voteEndpoints);
    router.post("/api/voteOnSponsorTime", ...voteEndpoints);

    //Endpoint when a submission is skipped
    router.get("/api/viewedVideoSponsorTime", ...viewEndpoints);
    router.post("/api/viewedVideoSponsorTime", ...viewEndpoints);

    // username
    router.post("/api/setUsername", setUsername);
    router.get("/api/getUsername", getUsername);
    // get userID from username
    router.get("/api/userID", getUserID);

    // user stats
    router.get("/api/getViewsForUser", getViewsForUser);
    router.get("/api/getSavedTimeForUser", getSavedTimeForUser);
    router.get("/api/userInfo", getUserInfo);
    router.get("/api/userStats", getUserStats);

    // total stats
    router.get("/api/getTopUsers", getTopUsers);
    router.get("/api/getTopCategoryUsers", getTopCategoryUsers);
    router.get("/api/getTotalStats", getTotalStats);
    router.get("/api/getDaysSavedFormatted", getDaysSavedFormatted);

    // server status
    router.get("/api/status/:value", (req, res) => getStatus(req, res, server));
    router.get("/api/status", (req, res) => getStatus(req, res, server));
    router.get("/api/ready", (req, res) => getReady(req, res, server));

    //submit video to lock categories
    router.post("/api/noSegments", postLockCategories);
    router.post("/api/lockCategories", postLockCategories);
    // get lock categores from userID
    router.get("/api/lockCategories", getLockCategories);
    router.get("/api/lockCategories/:prefix", getLockCategoriesByHash);
    router.get("/api/lockReason", getLockReason);
    // delete
    router.delete("/api/noSegments", deleteLockCategoriesEndpoint);
    router.delete("/api/lockCategories", deleteLockCategoriesEndpoint);

    //Endpoint used to hide a certain user's data
    router.post("/api/shadowBanUser", shadowBanUser);
    //sent user a warning
    router.post("/api/warnUser", postWarning);

    // VIP
    router.post("/api/addUserAsVIP", addUserAsVIP);
    router.post("/api/addUserAsTempVIP", addUserAsTempVIP);
    router.get("/api/isUserVIP", getIsUserVIP);

    router.post("/api/segmentShift", postSegmentShift);

    //get segment info
    router.get("/api/segmentInfo", getSegmentInfo);

    //clear cache as VIP
    router.post("/api/clearCache", postClearCache);
    router.post("/api/purgeAllSegments", postPurgeAllSegments);

    // feature
    router.post("/api/feature", addFeature);
    router.get("/api/featureFlag/:name", getFeatureFlag);

    // labels
    router.get("/api/videoLabels", getVideoLabels);
    router.get("/api/videoLabels/:prefix", getVideoLabelsByHash);

    // port videos
    router.get("/api/portVideo", getPortVideo);
    router.get("/api/portVideo/:prefix", getPortVideoByHash);
    router.post("/api/portVideo", postPortVideo);
    router.post("/api/votePort", voteOnPortVideo);
    router.post("/api/updatePortedSegments", updatePortedSegments);
}
