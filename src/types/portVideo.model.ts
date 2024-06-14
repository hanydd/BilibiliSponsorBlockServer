import { VideoID } from "./segments.model";

export type portVideoUUID = string & { __portVideoUUIDBrand: unknown };

export interface PortVideo {
    bvID: VideoID;
    ytbID: VideoID;
    UUID: portVideoUUID;
    votes: number;
    locked: boolean;
    hidden: boolean;
    biliDuration: number;
    ytbDuration: number;
    timeSubmitted: number;
}
