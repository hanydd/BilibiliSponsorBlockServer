import { Request, Response } from "express";
import { db } from "../databases/databases";
import { PortVideo } from "../types/portVideo.model";

export async function getPortVideo(req: Request, res: Response): Promise<Response> {
    const videoID = req.query.videoID;

    const portVideoInfo: PortVideo = await db.prepare(
        "get",
        `SELECT "bvID", "ytbID", "UUID", "votes", "locked", "biliDuration", "ytbDuration" FROM "portVideo"
        WHERE "bvID" = ? AND "votes" > -2`,
        [videoID]
    );

    return res.status(200).json(portVideoInfo);
}
