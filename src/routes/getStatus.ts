import { db } from "../databases/databases";
import { Logger } from "../utils/logger";
import { Request, Response } from "express";
import os from "os";
import redis from "../utils/redis";
import { promiseOrTimeout } from "../utils/promise";

export async function getStatus(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    let value = req.params.value as string[] | string;
    value = Array.isArray(value) ? value[0] : value;
    let processTime, redisProcessTime = -1;
    try {
        const dbVersion = await promiseOrTimeout(db.prepare("get", "SELECT key, value FROM config where key = ?", ["version"]), 5000)
            .then(e => {
                processTime = Date.now() - startTime;
                return e.value;
            })
            .catch(e => {
                Logger.error(`status: SQL query timed out: ${e}`);
                return -1;
            });
        let statusRequests: unknown = 0;
        const numberRequests = await promiseOrTimeout(redis.increment("statusRequest"), 5000)
            .then(e => {
                redisProcessTime = Date.now() - startTime;
                return e;
            }).catch(e => {
                Logger.error(`status: redis increment timed out ${e}`);
                return [-1];
            });
        statusRequests = numberRequests?.[0];

        const statusValues: Record<string, any> = {
            uptime: process.uptime(),
            commit: (global as any).HEADCOMMIT || "unknown",
            db: Number(dbVersion),
            startTime,
            processTime,
            redisProcessTime,
            loadavg: os.loadavg().slice(1), // only return 5 & 15 minute load average
            statusRequests,
            hostname: os.hostname()
        };
        return value ? res.send(JSON.stringify(statusValues[value])) : res.send(statusValues);
    } catch (err) {
        Logger.error(err as string);
        return res.sendStatus(500);
    }
}
