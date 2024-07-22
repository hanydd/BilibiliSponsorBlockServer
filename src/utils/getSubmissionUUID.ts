import { getHash } from "./getHash";
import { HashedValue } from "../types/hash.model";
import { ActionType, VideoID, Service, Category, VideoDuration } from "../types/segments.model";
import { HashedUserID } from "../types/user.model";

export function getSubmissionUUID(
    videoID: VideoID,
    category: Category,
    actionType: ActionType,
    description: string,
    userID: HashedUserID,
    startTime: number,
    endTime: number,
    service: Service
) : HashedValue {
    return `${getHash(`${videoID}${startTime}${endTime}${userID}${description}${category}${actionType}${service}`, 1)}7` as HashedValue;
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

export function getPortSegmentUUID(bvID: VideoID, ytbID: VideoID, ytbUUID: string, timeSubmitted: number): HashedValue {
    return `${getHash(`${bvID}${ytbID}${ytbUUID}${timeSubmitted}`)}9` as HashedValue;
}
