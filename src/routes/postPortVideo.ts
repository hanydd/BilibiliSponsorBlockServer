import { Request, Response, response } from "express";
import { Segment, VideoDuration } from "../types/segments.model";
import { db, privateDB } from "../databases/databases";
import { HashedUserID } from "../types/user.model";
import { getHashCache } from "../utils/getHashCache";
import { config } from "../config";
import * as youtubeID from "../utils/youtubeID";
import * as biliID from "../utils/bilibiliID";
import axios from "axios";
import { getVideoDetails } from "../utils/getVideoDetails";
import { parseUserAgent } from "../utils/userAgent";
import { getMatchVideoUUID } from "../utils/getSubmissionUUID";
import { isUserVIP } from "../utils/isUserVIP";
import { Logger } from "../utils/logger";
import { PortVideo } from "../types/portVideo.model";
import { ISODurationRegex, parseISODurationToSeconds } from "../utils/parseTime";
import { average } from "../utils/array";

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

const ytbTimeRegex = new RegExp(`"duration: ?(${ISODurationRegex.source})"`);

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

    const invalidCheckResult = checkInvalidFields(bvID, ytbID, paramUserID);
    if (!invalidCheckResult.pass) {
        return res.status(invalidCheckResult.errorCode).send(invalidCheckResult.errorMessage);
    }

    const getSegments = axios.get(
        `https://sponsor.ajay.app/api/skipSegments?videoID=${ytbID}` +
            '&categories=["sponsor","poi_highlight","exclusive_access","selfpromo","interaction","intro",' +
            '"outro","preview","filler","music_offtopic"]&actionTypes=["skip","poi","mute","full"]',
        { timeout: 5000 }
    );
    const getBiliDetail = getVideoDetails(bvID, true);

    const [sbResult, biliVideoDetail] = await Promise.all([getSegments, getBiliDetail]);

    if (sbResult.status != 200 && sbResult.status != 404) {
        res.status(400).send("无法连接SponsorBlock服务器");
    }
    const ytbSegments: Array<Segment> = sbResult.data;

    // get ytb video duration
    let ytbDuration: VideoDuration = 0 as VideoDuration;
    if (sbResult.status === 404 || ytbSegments.length === 0) {
        // use YouTube Data API to get video information via shield.io
        const shieldRes = await axios.get(
            `https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2
            Fwww.googleapis.com%2Fyoutube%2Fv3%2Fvideos%3Fid%3D${ytbID}%26part%3DcontentDetails%26key
            %3D${config.youtubeDataApiKey}&query=%24.items%5B%3A1%5D.contentDetails.duration&label=duration`,
            { timeout: 5000 }
        );
        ytbDuration = parseISODurationToSeconds(
            decodeURIComponent(shieldRes.data).match(ytbTimeRegex)[1]
        ) as VideoDuration;

        Logger.info(`Retrieving YTB video duration ${ytbID} via Data API: ${ytbDuration}s`);
    } else {
        ytbDuration = average(ytbSegments.map((s) => s.videoDuration)) as VideoDuration;
        Logger.info(`Retrieved ${ytbSegments.length} segments from SB server. Average video duration: ${ytbDuration}s`);
    }

    // video duration check
    if (!ytbDuration) {
        return res.status(500).send(`无法获取YouTube视频信息，请重试。
如果始终无法提交，您可以前往项目地址反馈：https://github.com/HanYaodong/BilibiliSponsorBlock/issues/new`);
    }
    if (paramBiliDuration && Math.abs(paramBiliDuration - biliVideoDetail?.duration) > 2) {
        return res.status(400).send("视频时长异常，请刷新页面再试");
    }
    if (Math.abs(ytbDuration - biliVideoDetail?.duration) > 3) {
        return res.status(400).send("视频时长不一致，无法绑定");
    }

    // TODO: handle duration change
    // check existing matches
    const existingMatch: Array<PortVideo> = await db.prepare(
        "all",
        `SELECT "bvID", "ytbID", "UUID", "votes", "locked", "hidden", "biliDuration", "ytbDuration"
        FROM "portVideo" WHERE "bvID" = ? AND "ytbID" = ?`,
        [bvID, ytbID]
    );
    if (existingMatch.length > 0) {
        if (existingMatch.filter((s) => s.votes <= -2 || s.hidden).length > 0) {
            return res.status(409).send("此YouTube视频已被标记为错误的搬运视频！");
        } else {
            // TODO: count submission as vote
            return res.status(200).send("OK");
        }
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
             "biliDuration", "ytbDuration", "userAgent", "hidden") VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
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
                0,
            ]
        );
    } catch (err) {
        Logger.error(err as string);
        return res.sendStatus(500);
    }

    // save all segments

    return res.status(200).send("OK");
}

function checkInvalidFields(bvID: string, ytbID: string, paramUserID: string): CheckResult {
    const invalidFields = [];
    const errors = [];

    if (typeof ytbID !== "string" || ytbID?.length == 0) {
        invalidFields.push("ytbID");
    }
    if (typeof bvID !== "string" || bvID?.length == 0) {
        invalidFields.push("bvID");
    }

    const minLength = config.minUserIDLength;
    if (typeof paramUserID !== "string" || paramUserID?.length < minLength) {
        invalidFields.push("userID");
        if (paramUserID?.length < minLength) errors.push(`userID must be at least ${minLength} characters long`);
    }

    if (config.mode !== "test") {
        const sanitizedYtbID = youtubeID.validate(ytbID) ? ytbID : youtubeID.sanitize(ytbID);
        if (!youtubeID.validate(sanitizedYtbID)) {
            invalidFields.push("ytbID");
            errors.push("YouTube videoID could not be extracted");
        }

        const sanitizedBvID = biliID.validate(bvID) ? bvID : biliID.sanitize(bvID);
        if (!biliID.validate(sanitizedBvID)) {
            invalidFields.push("bvID");
            errors.push("Bilibili videoID could not be extracted");
        }
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
