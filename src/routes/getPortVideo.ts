import { Request, Response } from "express";
import { getPortVideoByBvIDCached, getPortVideoByHashPrefixCached, getPortVideoDBByBvIDCached } from "../dao/portVideo";
import {
    createSegmentsFromYTB,
    getSegmentsFromDBByVideoID,
    hideByUUID,
    saveNewSegments,
    updateVotes,
} from "../dao/skipSegment";
import { db } from "../databases/databases";
import { HashedValue } from "../types/hash.model";
import { PortVideo, PortVideoDB, PortVideoInterface } from "../types/portVideo.model";
import { DBSegment, HiddenType, Service, VideoDuration, VideoID } from "../types/segments.model";
import { average } from "../utils/array";
import { validate } from "../utils/bilibiliID";
import { durationEquals, durationsAllEqual } from "../utils/durationUtil";
import { getVideoDetails } from "../utils/getVideoDetails";
import { getYoutubeSegments, getYoutubeVideoDuraion } from "../utils/getYoutubeVideoSegments";
import { Logger } from "../utils/logger";

export async function updatePortedSegments(req: Request, res: Response) {
    const bvid = req.body.videoID as VideoID;

    const portVideoRecord = await getPortVideoDBByBvIDCached(bvid);
    await getSegmentsFromSB(portVideoRecord[0]);
    return res.sendStatus(200);
}

export async function getSegmentsFromSB(portVideo: PortVideoDB) {
    const bvID = portVideo.bvID;
    const ytbID = portVideo.ytbID;
    const [ytbSegments, biliVideoDetail] = await Promise.all([getYoutubeSegments(ytbID), getVideoDetails(bvID, true)]);
    // get ytb video duration
    let ytbDuration = 0 as VideoDuration;
    if (ytbSegments && ytbSegments.length > 0) {
        ytbDuration = average(
            ytbSegments.filter((s) => s.videoDuration > 0).map((s) => s.videoDuration)
        ) as VideoDuration;
        Logger.info(`Retrieved ${ytbSegments.length} segments from SB server. Average video duration: ${ytbDuration}s`);
    }
    if (!ytbDuration) {
        ytbDuration = await getYoutubeVideoDuraion(ytbID);
    }
    // video duration check
    const dbBiliDuration = portVideo.biliDuration;
    const dbYtbDuration = portVideo.biliDuration;
    // we need all four durations to match to proceed
    if (!ytbDuration) {
        // if no youtube duration is provided, dont't do anything
        return;
    }
    const apiBiliDuration = biliVideoDetail?.duration as VideoDuration;
    if (!apiBiliDuration) {
        // if no bili duration is found, dont't do anything
        return;
    }
    if (!durationEquals(dbBiliDuration, apiBiliDuration)) {
        // TODO invalidate all segmetns, including the user submitted ones
        return;
    }

    // get all port segments
    const allDBSegments = await getSegmentsFromDBByVideoID(bvID, Service.YouTube);
    const portedSegments = allDBSegments.filter((s) => s.portUUID === portVideo.UUID);
    const existingYoutubeSegmentUUIDs = new Set(portedSegments.map((s) => s.ytbSegmentUUID));
    const ytbSegmentsMap = new Map(ytbSegments.map((s) => [s.UUID, s]));

    // request removed segments again to ensure that they are removed
    const removedSegments = portedSegments.filter((s) => !ytbSegmentsMap.has(s.ytbSegmentUUID));

    if (removedSegments.length > 0) {
        Logger.info(`Removed segments found: ${JSON.stringify(removedSegments)}`);
        const removedUUID = removedSegments.map((s) => s.ytbSegmentUUID);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const reAquiredSegments = await getYoutubeSegments(ytbID, removedUUID);
        reAquiredSegments.forEach((s) => ytbSegmentsMap.set(s.UUID, s));
    }

    Logger.info(`all YTB segments: ${JSON.stringify([...ytbSegmentsMap.entries()])}`);

    const allYtbSegments = [...ytbSegmentsMap.values()];

    // new and update and to be removed segments
    const truelyRemovedSegments = portedSegments.filter((s) => !ytbSegmentsMap.has(s.ytbSegmentUUID));
    const newSegments = allYtbSegments.filter((s) => !existingYoutubeSegmentUUIDs.has(s.UUID));
    const updatingSegments = portedSegments.filter((s) => ytbSegmentsMap.has(s.ytbSegmentUUID));

    // update votes for existing segments
    updatingSegments.forEach((s) => {
        s.videoID = bvID;
        s.votes = ytbSegmentsMap.get(s.ytbSegmentUUID).votes;
    });

    // crate new segments
    const timeSubmitted = Date.now();

    const saveSegment: DBSegment[] = createSegmentsFromYTB(
        newSegments,
        bvID,
        ytbID,
        timeSubmitted,
        0, // PORT segment does not have reputation
        portVideo.userAgent,
        portVideo.UUID
    );

    // db operations
    Logger.info(`remove segments: ${truelyRemovedSegments.map((s) => s.UUID)}`);
    await hideByUUID(
        truelyRemovedSegments.map((s) => s.UUID),
        bvID
    );

    Logger.info(`new segments: ${saveSegment.map((s) => s.UUID)}`);
    await saveNewSegments(saveSegment);

    Logger.info(`update segments: ${updatingSegments.map((s) => s.UUID)}`);
    await updateVotes(updatingSegments);
}

export async function getPortVideo(req: Request, res: Response): Promise<Response> {
    const bvID = req.query.videoID as VideoID;
    const duration = parseFloat(req.query.duration as string) || 0;

    // validate parameters
    if (!validate(bvID)) {
        return res.status(400).send("无效BV号");
    }

    // get cached data from redis
    const portVideoInfo: PortVideo[] = await getPortVideoByBvIDCached(bvID);

    if (!portVideoInfo || portVideoInfo.length == 0) {
        return res.sendStatus(404);
    } else if (portVideoInfo.length >= 2) {
        // multiple found
        // TODO: mark the highes vote or latest as the only valid record
        Logger.error(`Multiple port video matches found for ${bvID}`);
    }

    const portVideo = portVideoInfo[0];

    if (duration > 0) {
        await checkDuration(portVideo, duration);
    }

    return res.json({
        bvID: portVideo.bvID,
        ytbID: portVideo.ytbID,
        UUID: portVideo.UUID,
        votes: portVideo.votes,
        locked: portVideo.locked,
    } as PortVideoInterface);
}

export async function getPortVideoByHash(req: Request, res: Response): Promise<Response> {
    const hashPrefix = req.params.prefix as HashedValue;

    // validate parameters
    if (!hashPrefix) {
        return res.status(400).send("无效参数");
    }

    // get data and cache in redis
    const portVideoInfo: PortVideoInterface[] = await getPortVideoByHashPrefixCached(hashPrefix);

    if (!portVideoInfo || portVideoInfo.length == 0) {
        return res.sendStatus(404);
    }
    return res.json(portVideoInfo);
}

async function checkDuration(portVideo: PortVideo, duration: number): Promise<boolean> {
    if (durationsAllEqual([duration, portVideo.biliDuration, portVideo.ytbDuration])) {
        return true;
    }

    // duration mismatch, use api to get the correct duration

    // mark the record as invalid
    await db.prepare("run", `UPDATE "portVideo" SET "hidden" = 1 WHERE "UUID" = ?`, [portVideo.UUID]);
    await db.prepare("run", `UPDATE "sponsorTimes" SET "hidden" = ? WHERE "portUUID" = ?`, [
        HiddenType.MismatchHidden,
        portVideo.UUID,
    ]);

    return false;
}
