import { Request, Response } from "express";
import { getSegmentsFromDBByHash, getSegmentsFromDBByVideoID } from "../dao/skipSegment";
import { SBRecord } from "../types/lib.model";
import { ActionType, DBSegment, HiddenType, Service, VideoID, VideoIDHash, VideoLabel, VideoLabelData } from "../types/segments.model";
import { getService } from "../utils/getService";
import { Logger } from "../utils/logger";

function transformDBSegments(segments: DBSegment[]): VideoLabel[] {
    return segments.map((chosenSegment) => ({
        cid: chosenSegment.cid,
        category: chosenSegment.category,
        UUID: chosenSegment.UUID,
        locked: chosenSegment.locked,
        votes: chosenSegment.votes,
        videoDuration: chosenSegment.videoDuration,
    }));
}

async function getLabelsByVideoID(videoID: VideoID, service: Service): Promise<VideoLabel[]> {
    try {
        const segments: DBSegment[] = await getSegmentsFromDBByVideoID(videoID, service);
        return chooseSegment(segments);
    } catch (err) {
        if (err) {
            Logger.error(err as string);
            return null;
        }
    }
}

async function getLabelsByHash(hashedVideoIDPrefix: VideoIDHash, service: Service): Promise<SBRecord<VideoID, VideoLabelData>> {
    const segments: SBRecord<VideoID, VideoLabelData> = {};

    try {
        type SegmentWithHashPerVideoID = SBRecord<VideoID, { hash: VideoIDHash, segments: DBSegment[] }>;

        const segmentPerVideoID: SegmentWithHashPerVideoID = (await getSegmentsFromDBByHash(hashedVideoIDPrefix, service))
            .reduce((acc: SegmentWithHashPerVideoID, segment: DBSegment) => {
                acc[segment.videoID] = acc[segment.videoID] || {
                    hash: segment.hashedVideoID,
                    segments: []
                };

                acc[segment.videoID].segments ??= [];
                acc[segment.videoID].segments.push(segment);

                return acc;
            }, {});

        for (const [videoID, videoData] of Object.entries(segmentPerVideoID)) {
            const data: VideoLabelData = {
                segments: chooseSegment(videoData.segments),
            };

            if (data.segments.length > 0) {
                segments[videoID] = data;
            }
        }

        return segments;
    } catch (err) {
        Logger.error(err as string);
        return null;
    }
}

function chooseSegment<T extends DBSegment>(choices: T[]): VideoLabel[] {
    // filter out -2 segments
    choices = choices.filter(segment => segment.actionType == ActionType.Full && segment.votes > -2 && segment.hidden == HiddenType.Show);
    const results = [];
    // trivial decisions
    if (choices.length === 0) {
        return [];
    } else if (choices.length === 1) {
        return transformDBSegments(choices);
    }
    // if locked, only choose from locked
    const locked = choices.filter((segment) => segment.locked);
    if (locked.length > 0) {
        choices = locked;
    }
    //no need to filter, just one label
    if (choices.length === 1) {
        return transformDBSegments(choices);
    }
    // sponsor > exclusive > selfpromo
    const findCategory = (category: string) => choices.find((segment) => segment.category === category);

    const categoryResult = findCategory("sponsor") ?? findCategory("exclusive_access") ?? findCategory("selfpromo");
    if (categoryResult) results.push(categoryResult);

    return transformDBSegments(results);
}

async function handleGetLabel(req: Request, res: Response): Promise<VideoLabel[] | false> {
    const videoID = req.query.videoID as VideoID;
    if (!videoID) {
        res.status(400).send("videoID not specified");
        return false;
    }

    const service = getService(req.query.service, req.body.service);
    const segments = await getLabelsByVideoID(videoID, service);

    if (!segments || segments.length === 0) {
        res.sendStatus(404);
        return false;
    }

    return segments;
}

async function endpoint(req: Request, res: Response): Promise<Response> {
    try {
        const segments = await handleGetLabel(req, res);

        // If false, res.send has already been called
        if (segments) {
            //send result
            return res.send(segments);
        }
    } catch (err) {
        if (err instanceof SyntaxError) {
            return res.status(400).send("Categories parameter does not match format requirements.");
        } else return res.sendStatus(500);
    }
}

export {
    endpoint, getLabelsByHash, getLabelsByVideoID
};
