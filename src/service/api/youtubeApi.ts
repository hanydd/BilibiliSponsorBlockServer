import axios from "axios";
import { config } from "../../config";
import { VideoDuration } from "../../types/segments.model";
import { APIVideoData, APIVideoInfo } from "../../types/youtubeApi.model";
import DiskCache from "../../utils/diskCache";
import { ISODurationRegex, parseISODurationToVideoDuration } from "../../utils/durationUtil";
import { Logger } from "../../utils/logger";

export class YouTubeAPI {
    static ytbTimeRegex = new RegExp(`"duration: ?(${ISODurationRegex.source}|no result)"`);

    static async listVideos(videoID: string, ignoreCache = false): Promise<APIVideoInfo> {
        if (!videoID || videoID.length !== 11 || videoID.includes(".")) {
            return { err: "Invalid video ID" };
        }

        const cacheKey = `yt.newleaf.video.${videoID}`;
        if (!ignoreCache) {
            try {
                const data = await DiskCache.get(cacheKey);

                if (data) {
                    Logger.debug(`YouTube API: cache used for video information: ${videoID}`);
                    return { err: null, data: data as APIVideoData };
                }
            } catch (err) {
                return { err: err as string | boolean, data: null };
            }
        }

        if (!config.newLeafURLs || config.newLeafURLs.length <= 0) return { err: "NewLeaf URL not found", data: null };

        try {
            const result = await axios.get(
                `${config.newLeafURLs[Math.floor(Math.random() * config.newLeafURLs.length)]}/api/v1/videos/${videoID}`,
                {
                    timeout: 3500,
                }
            );

            if (result.status === 200) {
                const data = result.data;
                if (data.error) {
                    Logger.warn(`NewLeaf API Error for ${videoID}: ${data.error}`);
                    return { err: data.error, data: null };
                }
                const apiResult = data as APIVideoData;
                DiskCache.set(cacheKey, apiResult)
                    .then(() => Logger.debug(`YouTube API: video information cache set for: ${videoID}`))
                    .catch((err: any) => Logger.warn(err));

                return { err: false, data: apiResult };
            } else {
                return { err: result.statusText, data: null };
            }
        } catch (err) {
            return { err: err as string | boolean, data: null };
        }
    }

    /**
     * use YouTube Data API to get video information via shield.io
     */
    static getYoutubeVideoDuraion(ytbID: string): Promise<VideoDuration | null> {
        // the video ID is assused to be checked and clean
        Logger.info(`Retrieving YTB video duration ${ytbID} using Data API`);
        return axios
            .get(
                `https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fwww.googleapis.com%2Fyoutube%2Fv3%2Fvideos%3Fid%3D${ytbID}%26part%3DcontentDetails%26key%3D${config.youtubeDataApiKey}&query=%24.items%5B%3A1%5D.contentDetails.duration&label=duration`,
                { timeout: 10000 }
            )
            .then((res) => {
                const match = res.data.match(this.ytbTimeRegex);
                if (!match || match[1] === "no result") {
                    return null;
                }
                return parseISODurationToVideoDuration(match[1]);
            })
            .catch((e) => {
                Logger.error(`Error when trying to retrieve YTB video duration ${ytbID}`);
                Logger.error(e.message);
                return null;
            });
    }
}

export const getMaxResThumbnail = (videoID: string): string =>
    `https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${videoID}&redirectUrl=https://i.ytimg.com/vi/${videoID}/maxresdefault.jpg`;
