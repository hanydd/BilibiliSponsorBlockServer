import { BilibiliPagelistDetail } from "../types/bilibiliPagelist.model";
import { BilibiliVideoDetailView } from "../types/bilibiliViewApi.model";
import { Logger } from "./logger";
import axios from "axios";

export class BilibiliAPI {

    static async getPagelist(videoID: string): Promise<BilibiliPagelistDetail[]> {
        // TODO: validate video id

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

    static async getVideoDetailsFromPagelist(videoID: string): Promise<BilibiliPagelistDetail> {
        const pagelist = await this.getPagelist(videoID);
        return pagelist[0];
    }

    static async getVideoDetailView(videoID: string): Promise<BilibiliVideoDetailView> {
        Logger.info(`Getting video detail from view API: ${videoID}`);
        const url = "https://api.bilibili.com/x/web-interface/view";
        const result = await axios.get(url, { params: { bvid: videoID }, timeout: 20000 });

        if (result.status === 200 && result.data.code === 0) {
            return result.data.data;
        } else {
            return Promise.reject(`Bilibili Pagelist API non-200 response of ${videoID}: ${result.data.message}`);
        }
    }

}
