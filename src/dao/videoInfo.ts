import { db } from "../databases/databases";
import { VideoDetail } from "../utils/getVideoDetails";

export async function saveVideoInfo(biliVideoDetail: VideoDetail) {
    for (const page of biliVideoDetail.page) {
        await db.prepare(
            "run",
            `INSERT INTO "videoInfo" ("videoID", "cid", "channelID", "title", "part", "partTitile", "published") SELECT ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM "videoInfo" WHERE "videoID" = ? AND "cid" = ?)`,
            [
                biliVideoDetail.videoId,
                page.cid,
                biliVideoDetail?.authorId || "",
                biliVideoDetail?.title || "",
                page?.page || 0,
                page?.part || "",
                biliVideoDetail?.published || 0,
                biliVideoDetail.videoId,
                page.cid,
            ]
        );
    }
}
