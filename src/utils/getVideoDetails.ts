import { BilibiliVideoDetailView } from "../types/bilibiliViewApi.model";
import { Logger } from "./logger";
import { QueryCacher } from "./queryCacher";
import { videoDetailCacheKey } from "../service/redis/redisKeys";
import { BilibiliAPI } from "../service/api/bilibiliApi";

export interface VideoPageDetail {
    cid: string;
    page: number;
    part: string;
    duration: number;
}

export interface VideoDetail {
    videoId: string;
    authorId: string;
    authorName: string;
    title: string;
    published: number;
    page: VideoPageDetail[];
}

const convertFromVideoViewAPI = (videoId: string, input: BilibiliVideoDetailView): VideoDetail => {
    return {
        videoId: videoId,
        authorId: input.owner.mid.toString(),
        authorName: input.owner.name,
        title: input.title,
        published: input.pubdate,
        page: input.pages.map((page) => ({ cid: `${page.cid}`, page: page.page, part: page.part, duration: page.duration })),
    };
};

export function getVideoDetails(videoId: string, ignoreCache = false): Promise<VideoDetail | null> {
    if (ignoreCache) {
        QueryCacher.clearKey(videoDetailCacheKey(videoId));
    }

    async function getVideoDetailsFromAPI(videoId: string): Promise<VideoDetail> {
        const data = await BilibiliAPI.getVideoDetailView(videoId);
        return convertFromVideoViewAPI(videoId, data);
    }

    try {
        return QueryCacher.get(() => getVideoDetailsFromAPI(videoId), videoDetailCacheKey(videoId), -1);
    } catch (e: any) {
        Logger.error(e.message);
        return null;
    }
}
