import KeyedQueue from "../../utils/KeyedQueue";

interface QueueItem {
    func: () => Promise<unknown>;
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
}

/**
 * A queue that separates the api calls to avoid rate limiting
 */
export class ApiQueue {
    private rate: number;
    private checkFrequency: number;

    private isRunning: boolean;
    private isWaiting: boolean;
    private nextRequest: number;
    private queue: KeyedQueue<QueueItem>;

    constructor(rate = 5000, checkFrequency = 100) {
        this.rate = rate;
        this.checkFrequency = checkFrequency;

        this.isRunning = false;
        this.isWaiting = false;
        this.nextRequest = 0;
        this.queue = new KeyedQueue();
        this.callApi = this.callApi.bind(this);
        this.checkToCallApi = this.checkToCallApi.bind(this);
    }

    public callApi<T>(key: string, func: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(key, { func, resolve, reject } as QueueItem);
            this.checkToCallApi();
        });
    }

    private checkToCallApi() {
        if (!this.isRunning && this.queue.length() > 0 && performance.now() >= this.nextRequest) {
            this.isRunning = true;
            const { key, list } = this.queue.shift();

            if (list.length === 0) {
                this.nextRequest = performance.now() + this.rate;
                this.isRunning = false;
            } else {
                list[0]
                    .func()
                    .then((result) => list.forEach((item) => item.resolve(result)))
                    .catch((reason) => list.forEach((item) => item.reject(reason)))
                    .finally(() => {
                        this.nextRequest = performance.now() + this.rate;
                        this.isRunning = false;
                    });
            }
        }
        if (!this.isWaiting && this.queue.length() > 0) {
            this.isWaiting = true;
            setTimeout(() => {
                this.isWaiting = false;
                this.checkToCallApi();
            }, this.checkFrequency);
        }
    }
}
