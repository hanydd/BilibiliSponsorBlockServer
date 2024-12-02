interface KeyedQeuueItem<T> {
    key: string;
    list: T[];
}

export default class KeyedQueue<T> {
    private storage: Map<string, KeyedQeuueItem<T>>;
    queue: KeyedQeuueItem<T>[];

    constructor() {
        this.storage = new Map();
        this.queue = [];
    }

    enqueue(key: string, value: any) {
        if (!this.storage.has(key)) {
            const newItem = { key, list: [] } as KeyedQeuueItem<T>;
            this.storage.set(key, newItem);
            this.queue.push(newItem);
        }
        this.storage.get(key).list.push(value);
    }

    push(key: string, value: any) {
        this.enqueue(key, value);
    }

    // pop the first item from the queue
    shift(): KeyedQeuueItem<T> | undefined {
        const item = this.queue.shift();
        if (item) {
            this.storage.delete(item.key);
        }
        return item;
    }

    get(key: string): KeyedQeuueItem<T> {
        return this.storage.get(key);
    }

    has(key: string): boolean {
        return this.storage.has(key);
    }

    keys(): string[] {
        return Array.from(this.storage.keys());
    }

    length(): number {
        return this.queue.length;
    }
}
