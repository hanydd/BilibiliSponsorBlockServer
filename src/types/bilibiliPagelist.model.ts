import { BilibiliVideoDimension } from "./bilibiliCommonApi.model";

// https://api.BilibiliBilibili.com/x/player/pagelist
export interface BilibiliPagelistResponse {
    code: number;
    message: string;
    ttl: number;
    data?: BilibiliPagelistDetail[];
}

export interface BilibiliPagelistDetail {
    cid: number;
    page: number;
    from: string;
    part: string;
    duration: number;
    vid: string | null;
    weblink: string | null;
    dimension: BilibiliVideoDimension | null;
    first_frame: string | null;
}