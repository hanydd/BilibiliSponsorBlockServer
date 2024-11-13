import { Request, Response } from "express";
import {
    getPortVideoByBvIDCached,
    getPortVideoByHashPrefixCached,
    getPortVideoDBByBvIDCached,
    hidePortVideoByUUID,
} from "../dao/portVideo";
import { createSegmentsFromYTB, getSegmentsFromDBByVideoID, hideSegmentsByUUID, saveNewSegments, updateVotes } from "../dao/skipSegment";
import { HashedValue } from "../types/hash.model";
import { PortVideo, PortVideoDB, PortVideoInterface } from "../types/portVideo.model";
import { DBSegment, Service, VideoDuration, VideoID } from "../types/segments.model";
import { average } from "../utils/array";
import { validate } from "../validate/bilibiliID";
import { durationEquals, durationsAllEqual } from "../utils/durationUtil";
import { getVideoDetails } from "../utils/getVideoDetails";
import { getYoutubeSegments, getYoutubeVideoDuraion } from "../utils/getYoutubeVideoSegments";
import { Logger } from "../utils/logger";
import { acquireLock } from "../utils/redisLock";

export async function updatePortedSegments(req: Request, res: Response) {
    const bvid = req.body.videoID as VideoID;

    // do not release lock, but wait 1h for the lock to expire
    const lock = await acquireLock(`updatePortSegment:${bvid}`, 1000 * 60 * 60);
    if (!lock.status) {
        return res.status(429).send("已经有人刷新过啦，每小时只能刷新一次！");
    }

    const portVideoRecord = await getPortVideoDBByBvIDCached(bvid);
    if (!portVideoRecord || portVideoRecord.length === 0) {
        lock.unlock();
        return res.sendStatus(404);
    }
    await updateSegmentsFromSB(portVideoRecord[0]);
    return res.sendStatus(200);
}

export async function updateSegmentsFromSB(portVideo: PortVideoDB) {
    const bvID = portVideo.bvID;
    const cid = portVideo.cid;
    const ytbID = portVideo.ytbID;
    const [ytbSegments, biliVideoDetail] = await Promise.all([getYoutubeSegments(ytbID), getVideoDetails(bvID, true)]);
    // get ytb video duration
    let apiYtbDuration = 0 as VideoDuration;
    if (ytbSegments && ytbSegments.length > 0) {
        apiYtbDuration = average(ytbSegments.filter((s) => s.videoDuration > 0).map((s) => s.videoDuration)) as VideoDuration;
        Logger.info(`Retrieved ${ytbSegments.length} segments from SB server. Average video duration: ${apiYtbDuration}s`);
    }
    if (!apiYtbDuration) {
        apiYtbDuration = await getYoutubeVideoDuraion(ytbID);
    }
    // video duration check
    const dbBiliDuration = portVideo.biliDuration;
    const dbYtbDuration = portVideo.biliDuration;
    // we need all four durations to match to proceed
    if (!apiYtbDuration) {
        // if no youtube duration is provided, dont't do anything
        return;
    }
    const apiBiliDuration = biliVideoDetail?.page.filter((p) => p.cid == cid)[0]?.duration as VideoDuration;
    if (!apiBiliDuration) {
        // if no bili duration is found, dont't do anything
        return;
    }

    // get all port segments
    const allDBSegments = await getSegmentsFromDBByVideoID(bvID, Service.YouTube);
    const portedSegments = allDBSegments.filter((s) => s.portUUID === portVideo.UUID);
    const existingYoutubeSegmentUUIDs = new Set(portedSegments.map((s) => s.ytbSegmentUUID));
    const ytbSegmentsMap = new Map(ytbSegments.map((s) => [s.UUID, s]));

    if (!durationEquals(dbBiliDuration, apiBiliDuration)) {
        // invalidate all segmetns, including the user submitted ones
        await hideSegmentsByUUID(
            allDBSegments.map((s) => s.UUID),
            bvID
        );
        return;
    }
    if (!durationsAllEqual([dbBiliDuration, apiBiliDuration, dbYtbDuration, apiYtbDuration])) {
        // invalidate all ported segmetns, and port video record
        await hideSegmentsByUUID(
            portedSegments.map((s) => s.UUID),
            bvID
        );
        await hidePortVideoByUUID(portVideo.UUID, bvID);
        return;
    }

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
    await hideSegmentsByUUID(
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
