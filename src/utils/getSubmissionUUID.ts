import { HashedValue } from "../types/hash.model";
import { ActionType, Category, SegmentUUID, Service, VideoDuration, VideoID } from "../types/segments.model";
import { HashedUserID } from "../types/user.model";
import { getHash } from "./HashCacheUtil";

export function getSubmissionUUID(
    videoID: VideoID,
    cid: string,
    category: Category,
    actionType: ActionType,
    description: string,
    userID: HashedUserID,
    startTime: number,
    endTime: number,
    service: Service
) : HashedValue {
    return `${getHash(`${videoID}${cid}${startTime}${endTime}${userID}${description}${category}${actionType}${service}`, 1)}7` as HashedValue;
}

export function getMatchVideoUUID(
    bvID: VideoID,
    ytbID: VideoID,
    userID: HashedUserID,
    biliDuration: VideoDuration,
    ytbDuration: VideoDuration,
    timeSubmitted: number
): HashedValue {
    return `${getHash(`${bvID}${ytbID}${userID}${biliDuration}${ytbDuration}${timeSubmitted}`, 1)}8` as HashedValue;
}

export function getPortSegmentUUID(bvID: VideoID, ytbID: VideoID, ytbUUID: string, timeSubmitted: number): SegmentUUID {
    return `${getHash(`${bvID}${ytbID}${ytbUUID}${timeSubmitted}`)}9` as SegmentUUID;
}
