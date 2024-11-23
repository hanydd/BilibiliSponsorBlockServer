import { Service, VideoID, VideoIDHash } from "../../types/segments.model";
import { Feature, HashedUserID, UserID } from "../../types/user.model";
import { HashedValue } from "../../types/hash.model";
import { Logger } from "../../utils/logger";
import { RedisCommandArgument } from "@redis/client/dist/lib/commands";

export function skipSegmentsKey(videoID: VideoID, service: Service): string {
    return `segments.v5.${service}.videoID.${videoID}`;
}

export function skipSegmentGroupsKey(videoID: VideoID, cid: string, service: Service): string {
    if (cid === "*") {
        return `segments.groups.v4.${service}.videoID.${videoID}*`;
    }
    return `segments.groups.v4.${service}.videoID.${videoID}.${cid}`;
}

export function skipSegmentsHashKey(hashedVideoIDPrefix: VideoIDHash, service: Service): string {
    hashedVideoIDPrefix = hashedVideoIDPrefix.substring(0, 4) as VideoIDHash;
    if (hashedVideoIDPrefix.length !== 4) Logger.warn(`Redis skip segment hash-prefix key is not length 4! ${hashedVideoIDPrefix}`);

    return `segments.v5.${service}.${hashedVideoIDPrefix}`;
}

export function cidListKey(videoID: VideoID): string {
    return `cid.videoID.${videoID}`;
}

export const shadowHiddenIPKey = (videoID: VideoID, timeSubmitted: number, service: Service): string =>
    `segments.v1.${service}.videoID.${videoID}.shadow.${timeSubmitted}`;

export const reputationKey = (userID: UserID): string => `reputation.v1.user.${userID}`;

export function ratingHashKey(hashPrefix: VideoIDHash, service: Service): string {
    hashPrefix = hashPrefix.substring(0, 4) as VideoIDHash;
    if (hashPrefix.length !== 4) Logger.warn(`Redis rating hash-prefix key is not length 4! ${hashPrefix}`);

    return `rating.v1.${service}.${hashPrefix}`;
}

export function shaHashKey(singleIter: HashedValue): string {
    if (singleIter.length !== 64) Logger.warn(`Redis sha.hash key is not length 64! ${singleIter}`);

    return `sha.hash.${singleIter}`;
}

export const tempVIPKey = (userID: HashedUserID): string => `vip.temp.${userID}`;

export const videoLabelsKey = (videoID: VideoID, service: Service): string => `labels.v1.${service}.videoID.${videoID}`;

export function videoLabelsHashKey(hashedVideoIDPrefix: VideoIDHash, service: Service): string {
    hashedVideoIDPrefix = hashedVideoIDPrefix.substring(0, 3) as VideoIDHash;
    if (hashedVideoIDPrefix.length !== 3) Logger.warn(`Redis video labels hash-prefix key is not length 3! ${hashedVideoIDPrefix}`);

    return `labels.v1.${service}.${hashedVideoIDPrefix}`;
}

export function userFeatureKey(userID: HashedUserID, feature: Feature): string {
    return `user.v1.${userID}.feature.${feature}`;
}

export function shouldClientCacheKey(key: RedisCommandArgument): boolean {
    return (key as string).match(/^(?:segments\.|reputation\.|branding\.|labels\.)/) !== null;
}

export function getTopUserKey(sortBy: string, categoryStatsEnabled: boolean): string {
    return `topUsers.${sortBy}.${categoryStatsEnabled}`;
}

export function getTopCategoryUserKey(sortBy: string, category: string): string {
    return `topCategoryUsers.${sortBy}.${category}`;
}

export function portVideoCacheKey(videoID: VideoID) {
    return `port.video.v1.videoID.${videoID}`;
}

export function portVideoByHashCacheKey(hashPrefix: string) {
    return `port.video.v1.${hashPrefix.substring(0, 3)}`;
}

export function portVideoUserCountKey() {
    return `port.video.count`;
}

export function videoDetailCacheKey(videoID: string) {
    return `video.detail.v2.videoID.${videoID}`;
}
