import { HashedIP, HiddenType, VideoID, VoteType } from "./segments.model";
import { HashedUserID } from "./user.model";

export type portVideoUUID = string & { __portVideoUUIDBrand: unknown };

export interface PortVideo {
    bvID: VideoID;
    ytbID: VideoID;
    UUID: portVideoUUID;
    votes: number;
    locked: boolean;
    hidden: HiddenType;
    biliDuration: number;
    ytbDuration: number;
    timeSubmitted: number;
}

export interface PortVideoDB extends PortVideo {
    userID: HashedUserID;
    userAgent: string;
}

export interface PortVideoVotesDB {
    id: string;
    bvID: VideoID;
    UUID: portVideoUUID;
    type: VoteType;
    originalType: VoteType;
    originalVotes: number;
    userID: HashedUserID;
    hashedIP: HashedIP;
    timeSubmitted: number;
}
