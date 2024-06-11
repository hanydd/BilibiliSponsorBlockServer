import { VideoID } from "../types/segments.model";

const bvidRegex = new RegExp(/(BV[0-9A-Za-z]{10})/);
const exclusiveBvidRegex = new RegExp(`^${bvidRegex.source}$`);
const urlRegex = new RegExp(`video/${bvidRegex.source}($|/)`);

export function validate(bvid: string): boolean {
    return exclusiveBvidRegex.test(bvid);
}

export function sanitize(bvid: string): VideoID | null {
    bvid = decodeURIComponent(bvid);

    const strictMatch = bvid.match(exclusiveBvidRegex)?.[1];
    const urlMatch = bvid.match(urlRegex)?.[1];

    return strictMatch ? (strictMatch as VideoID) : urlMatch ? (urlMatch as VideoID) : null;
}
