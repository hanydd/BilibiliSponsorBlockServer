import axios from "axios";
import { config } from "../config";
import { Segment, SegmentUUID, VideoDuration } from "../types/segments.model";
import { ISODurationRegex, parseISODurationToVideoDuration } from "./durationUtil";
import { Logger } from "./logger";

const ytbTimeRegex = new RegExp(`"duration: ?(${ISODurationRegex.source}|no result)"`);

export function getYoutubeSegments(
    ytbID: string,
    requiredSegments: SegmentUUID[] = [],
    timeout = 10000
): Promise<Segment[] | null> {
    Logger.info(`Getting segments from the SB service: ${ytbID}`);
    const params = {
        videoID: ytbID,
        categories: `["sponsor","poi_highlight","exclusive_access","selfpromo","interaction","intro","outro","preview","filler","music_offtopic"]`,
        actionTypes: `["skip","poi","mute","full"]`,
        requiredSegments: requiredSegments.join(","),
    };
    return axios
        .get(`https://sponsor.ajay.app/api/skipSegments`, { params: params, timeout: timeout })
        .then((res) => {
            return res?.data;
        })
        .catch((error) => {
            if (error.response && error.response.status == 404) {
                Logger.info(`No segments found from SB service: ${ytbID}`);
                return [];
            }
            Logger.error(`Cannot get segments from the SB service ${ytbID}`);
            Logger.error(error.message);
            return null;
        });
}

/**
 * use YouTube Data API to get video information via shield.io
 */
export function getYoutubeVideoDuraion(ytbID: string): Promise<VideoDuration | null> {
    // the video ID is assused to be checked and clean
    Logger.info(`Retrieving YTB video duration ${ytbID} using Data API`);
    return axios
        .get(
            `https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fwww.googleapis.com%2Fyoutube%2Fv3%2Fvideos%3Fid%3D${ytbID}%26part%3DcontentDetails%26key%3D${config.youtubeDataApiKey}&query=%24.items%5B%3A1%5D.contentDetails.duration&label=duration`,
            { timeout: 10000 }
        )
        .then((res) => {
            const match = res.data.match(ytbTimeRegex);
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
