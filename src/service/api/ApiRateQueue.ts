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

    private runningKey: string;
    private runningList: QueueItem[];
    private isWaiting: boolean;
    private nextRequest: number;
    private queue: KeyedQueue<QueueItem>;

    constructor(rate = 5000, checkFrequency = 100) {
        this.rate = rate;
        this.checkFrequency = checkFrequency;

        this.resetRuningStatus();
        this.isWaiting = false;
        this.nextRequest = 0;
        this.queue = new KeyedQueue();
        this.callApi = this.callApi.bind(this);
        this.checkToCallApi = this.checkToCallApi.bind(this);
    }

    public callApi<T>(key: string, func: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            if (this.runningKey === key) {
                this.runningList.push({ func, resolve, reject } as QueueItem);
                return;
            }
            this.queue.push(key, { func, resolve, reject } as QueueItem);
            this.checkToCallApi();
        });
    }

    private checkToCallApi() {
        if (this.queue.length() == 0) {
            return;
        }
        if (!this.runningKey && performance.now() >= this.nextRequest) {
            this.runningKey = "tmp";
            const { key, list } = this.queue.shift();
            this.runningKey = key;
            this.runningList = list;

            if (list.length === 0) {
                this.resetRuningStatus();
            } else {
                this.runningList[0]
                    .func()
                    .then((result) => this.runningList.forEach((item) => item.resolve(result)))
                    .catch((reason) => this.runningList.forEach((item) => item.reject(reason)))
                    .finally(() => {
                        this.nextRequest = performance.now() + this.rate;
                        this.resetRuningStatus();
                    });
            }
        }
        if (!this.isWaiting) {
            this.isWaiting = true;
            setTimeout(() => {
                this.isWaiting = false;
                this.checkToCallApi();
            }, this.checkFrequency);
        }
    }

    private resetRuningStatus() {
        this.runningKey = null;
        this.runningList = null;
    }
}
