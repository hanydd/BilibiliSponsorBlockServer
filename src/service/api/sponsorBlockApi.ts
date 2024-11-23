import axios, { AxiosError } from "axios";
import { Segment, SegmentUUID } from "../../types/segments.model";
import { Logger } from "../../utils/logger";

export async function getYoutubeSegments(ytbID: string, requiredSegments: SegmentUUID[] = [], timeout = 10000): Promise<Segment[] | null> {
    Logger.info(`Getting segments from the SB service: ${ytbID}`);
    const params = {
        videoID: ytbID,
        categories: `["sponsor","poi_highlight","exclusive_access","selfpromo","interaction","intro","outro","preview","filler","music_offtopic"]`,
        actionTypes: `["skip","poi","mute","full"]`,
        requiredSegments: `[${requiredSegments.map((id) => `"${id}"`).join(",")}]`,
    };
    try {
        const res = await axios.get(`https://sponsor.ajay.app/api/skipSegments`, { params: params, timeout: timeout });
        return res?.data;
    } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response && axiosError.response.status == 404) {
            Logger.info(`No segments found from SB service: ${ytbID}`);
            return [];
        }
        Logger.error(`Cannot get segments from the SB service ${ytbID}`);
        Logger.error(axiosError.message);
        return null;
    }
}
