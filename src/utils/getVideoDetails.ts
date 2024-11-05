import { BilibiliVideoDetailView } from "../types/bilibiliViewApi.model";
import { BilibiliAPI } from "./bilibiliApi";
import { Logger } from "./logger";
import { QueryCacher } from "./queryCacher";
import { videoDetailCacheKey } from "./redisKeys";

export interface VideoPageDetail {
    cid: string;
    page: number;
    part: string;
    duration: number;
}

export interface VideoDetail {
    videoId: string;
    duration: number;
    authorId: string;
    authorName: string;
    title: string;
    published: number;
    page: VideoPageDetail[];
}

const convertFromVideoViewAPI = (videoId: string, input: BilibiliVideoDetailView): VideoDetail => {
    return {
        videoId: videoId,
        duration: input.pages.length >= 1 && input.pages[0].duration ? input.pages[0].duration : input.duration,
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

    return QueryCacher.get(() => getVideoDetailsFromAPI(videoId), videoDetailCacheKey(videoId));

    async function getVideoDetailsFromAPI(videoId: string): Promise<VideoDetail> {
        try {
            const data = await BilibiliAPI.getVideoDetailView(videoId);
            return convertFromVideoViewAPI(videoId, data);
        } catch (e: any) {
            Logger.error(e.message);
            return null;
        }
    }
}
