import axios from "axios";
import { BilibiliPagelistDetail } from "../../types/bilibiliPagelist.model";
import { BilibiliVideoDetailView } from "../../types/bilibiliViewApi.model";
import { Logger } from "../../utils/logger";
import { ApiQueue } from "./ApiRateQueue";

export class BilibiliAPI {
    static apiQueue = new ApiQueue(3000, 100);

    static getVideoDetailView(videoID: string): Promise<BilibiliVideoDetailView> {
        return this.apiQueue.callApi(videoID, () => getVideoDetailView(videoID));
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getPagelist(videoID: string): Promise<BilibiliPagelistDetail[]> {
    Logger.info(`Getting video detail from Pagelist API: ${videoID}`);
    const pagelist_url = "https://api.bilibili.com/x/player/pagelist";
    const result = await axios.get(pagelist_url, { params: { bvid: videoID }, timeout: 3500 });

    if (result.status === 200 && result.data.code === 0) {
        if (result.data.data.length === 0) {
            return Promise.reject(`Bilibili Pagelist API returned no data for ${videoID}`);
        }
        return result.data.data;
    } else {
        return Promise.reject(`Bilibili Pagelist API non-200 response of ${videoID}: ${result.data.message}`);
    }
}

async function getVideoDetailView(videoID: string): Promise<BilibiliVideoDetailView> {
    Logger.info(`Getting video detail from view API: ${videoID}`);
    const url = "https://api.bilibili.com/x/web-interface/view";
    const result = await axios.get(url, { params: { bvid: videoID }, timeout: 20000 });

    if (result.status === 200 && result.data.code === 0) {
        return result.data.data;
    } else {
        return Promise.reject(`Bilibili Pagelist API non-200 response of ${videoID}: ${result.data.message}`);
    }
}
