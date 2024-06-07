import { Request, Response, response } from "express";
import { Segment, VideoDuration } from "../types/segments.model";
import { db, privateDB } from "../databases/databases";
import { HashedUserID } from "../types/user.model";
import { getHashCache } from "../utils/getHashCache";
import { config } from "../config";
import * as youtubeID from "../utils/youtubeID";
import axios from "axios";
import { getVideoDetails } from "../utils/getVideoDetails";
import { parseUserAgent } from "../utils/userAgent";
import { getMatchVideoUUID } from "../utils/getSubmissionUUID";
import { isUserVIP } from "../utils/isUserVIP";
import { Logger } from "../utils/logger";

type CheckResult = {
    pass: boolean;
    errorMessage: string;
    errorCode: number;
};

const CHECK_PASS: CheckResult = {
    pass: true,
    errorMessage: "",
    errorCode: 0,
};

export async function postPortVideo(req: Request, res: Response): Promise<Response> {
    const bvID = req.query.bvID || req.body.bvID;
    const ytbID = req.query.ytbID || req.body.ytbID;
    const paramUserID = req.query.userID || req.body.userID;
    const paramBiliDuration: VideoDuration = (parseFloat(req.query.biliDuration || req.body.biliDuration) ||
        0) as VideoDuration;

    if (!paramUserID) {
        return res.status(400).send("No userID provided");
    }
    const userID: HashedUserID = await getHashCache(paramUserID);

    const invalidCheckResult = checkInvalidFields(bvID, ytbID, paramUserID, userID, paramBiliDuration);

    if (!invalidCheckResult.pass) {
        return res.status(invalidCheckResult.errorCode).send(invalidCheckResult.errorMessage);
    }

    const getSegments = axios.get(
        "https://sponsor.ajay.app/api/skipSegments?videoID=he_BL6Q5u1Y" +
            '&categories=["sponsor","poi_highlight","exclusive_access","selfpromo","interaction","intro",' +
            '"outro","preview","filler","music_offtopic"]&actionTypes=["skip","poi","mute","full"]'
    );
    const getBiliDetail = getVideoDetails(bvID, true);

    const [sbResult, biliVideoDetail] = await Promise.all([getSegments, getBiliDetail]);

    if (sbResult.status != 200 && sbResult.status != 404) {
        res.status(400).send("无法连接SponsorBlock服务器");
    }

    const ytbSegments: Array<Segment> = sbResult.data;
    if (sbResult.status === 404 || ytbSegments?.length === 0) {
        // TODO: find another way to verify video duration
        return res.status(404).send("YouTube数据库中无此视频片段");
    }

    // video duration check
    if (paramBiliDuration && Math.abs(paramBiliDuration - biliVideoDetail?.duration) > 2) {
        return res.status(400).send("视频时长异常，请刷新页面再试");
    }
    const ytbDuration = ytbSegments[0].videoDuration;
    if (Math.abs(ytbDuration - biliVideoDetail?.duration) > 3) {
        return res.status(200).send("视频时长不一致，无法绑定");
    }

    // prepare to be saved
    const isVIP = await isUserVIP(userID);
    const userAgent = req.query.userAgent ?? req.body.userAgent ?? parseUserAgent(req.get("user-agent")) ?? "";
    const timeSubmitted = Date.now();
    const matchVideoUUID = getMatchVideoUUID(bvID, ytbID, userID, paramBiliDuration, ytbDuration);
    const startingVotes = 0;
    const startingLocked = isVIP ? 1 : 0;

    // save match video
    try {
        await db.prepare(
            "run",
            `INSERT INTO "portVideo" ("bvID", "ytbID", "UUID", "votes", "locked", "userID", "timeSubmitted",
             "biliDuration", "ytbDuration", "userAgent") VALUES(?,?,?,?,?,?,?,?,?,?)`,
            [
                bvID,
                ytbID,
                matchVideoUUID,
                startingVotes,
                startingLocked,
                userID,
                timeSubmitted,
                paramBiliDuration,
                ytbDuration,
                userAgent,
            ]
        );
    } catch (err) {
        Logger.error(err as string);
        return res.sendStatus(500);
    }

    // save all segments

    return res.status(200).send("OK");
}

function checkInvalidFields(
    bvID: string,
    ytbID: string,
    paramUserID: string,
    userID: string,
    biliDuration: number
): CheckResult {
    const invalidFields = [];
    const errors = [];
    if (typeof ytbID !== "string" || ytbID?.length == 0) {
        invalidFields.push("ytbID");
    }
    if (config.mode !== "test") {
        const sanitizedYtbID = youtubeID.validate(ytbID) ? ytbID : youtubeID.sanitize(ytbID);
        if (!youtubeID.validate(sanitizedYtbID)) {
            invalidFields.push("ytbID");
            errors.push("YouTube videoID could not be extracted");
        }
    }

    // TODO: add bilibili id check

    const minLength = config.minUserIDLength;
    if (typeof userID !== "string" || userID?.length < minLength) {
        invalidFields.push("userID");
        if (userID?.length < minLength) errors.push(`userID must be at least ${minLength} characters long`);
    }

    if (invalidFields.length !== 0) {
        // invalid request
        const formattedFields = invalidFields.reduce((p, c, i) => p + (i !== 0 ? ", " : "") + c, "");
        const formattedErrors = errors.reduce((p, c, i) => p + (i !== 0 ? ". " : " ") + c, "");
        return {
            pass: false,
            errorMessage: `No valid ${formattedFields}.${formattedErrors}`,
            errorCode: 400,
        };
    }

    return CHECK_PASS;
}
