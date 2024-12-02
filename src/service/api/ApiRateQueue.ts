import { Logger } from "../../utils/logger";

// make a queue that separates the api calls to avoid rate limiting, the request limit is once per 5 seconds

interface QueueItem {
    key: string;
    func: () => Promise<unknown>;
    resolve: (value?: any) => void;
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

    public callApi<T>(key: string, func: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ key, func, resolve, reject });
            this.checkToCallApi();
        });
    }

    private checkToCallApi() {
        if (!this.isRunning && this.queue.length > 0 && performance.now() >= this.nextRequest) {
            this.isRunning = true;
            const { key, func, resolve, reject } = this.queue.shift();

            func()
                .then(resolve)
                .catch(reject)
                .finally(() => {
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
