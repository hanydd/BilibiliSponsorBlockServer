import { Request, Response } from "express";
import { Logger } from "../../utils/logger";
import { BilibiliAPI } from "./bilibiliApi";

// make a queue that separates the api calls to avoid rate limiting, the request limit is once per 5 seconds

interface QueueItem {
    videoID: string;
    resolve: (value?: unknown) => void;
    reject: (reason?: any) => void;
}

export class ApiQueue {
    private rate: number;
    private checkFrequency: number;

    private isRunning: boolean;
    private isWaiting: boolean;
    private nextRequest: number;
    private queue: QueueItem[];


    constructor(rate = 5000, checkFrequency = 100) {
        this.rate = rate;
        this.checkFrequency = checkFrequency;

        this.isRunning = false;
        this.isWaiting = false;
        this.nextRequest = 0;
        this.queue = [];
        this.callApi = this.callApi.bind(this);
        this.checkToCallApi = this.checkToCallApi.bind(this);
    }

    public callApi(videoID: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            this.queue.push({ videoID, resolve, reject });
            this.checkToCallApi();
        });
    }

    private checkToCallApi() {
        Logger.info(`checking to call api: ${this.isRunning} ${this.queue.length}`);

        if (!this.isRunning && this.queue.length > 0 && performance.now() >= this.nextRequest) {
            this.isRunning = true;
            const { videoID, resolve, reject } = this.queue.shift();

            BilibiliAPI.getVideoDetailView(videoID).then((result) => {
                resolve(result);
            }).catch(reject).finally(() => {
                this.nextRequest = performance.now() + this.rate;
                this.isRunning = false;
            });
        }
        if (!this.isWaiting && this.queue.length > 0) {
            this.isWaiting = true;
            setTimeout(() => {
                this.isWaiting = false;
                this.checkToCallApi();
            }, this.checkFrequency);
        }

    }
}

const api = new ApiQueue(5000, 100);


export async function testRoute(req: Request, res: Response) {
    const videoIDs = req.body.videoID as string[];
    const repsonse = await Promise.all(videoIDs.map(api.callApi));

    return res.send(repsonse);
}