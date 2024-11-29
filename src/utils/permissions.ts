import { db } from "../databases/databases";
import { userFeatureKey } from "../service/redis/redisKeys";
import { Category } from "../types/segments.model";
import { Feature, HashedUserID } from "../types/user.model";
import { QueryCacher } from "./queryCacher";

interface CanSubmitResult {
    canSubmit: boolean;
    reason: string;
}

async function lowDownvotes(userID: HashedUserID): Promise<boolean> {
    const result = await db.prepare(
        "get",
        `SELECT count(*) as "submissionCount", SUM(CASE WHEN "votes" < 0 AND "views" > 5 THEN 1 ELSE 0 END) AS "downvotedSubmissions" FROM "sponsorTimes" WHERE "userID" = ?`,
        [userID],
        { useReplica: true }
    );

    return result.submissionCount > 5 && result.downvotedSubmissions / result.submissionCount < 0.1;
}

export function canSubmit(userID: HashedUserID, category: Category): CanSubmitResult {
    switch (category) {
        default:
            return {
                canSubmit: true,
                reason: "",
            };
    }
}

export async function hasFeature(userID: HashedUserID, feature: Feature): Promise<boolean> {
    return await QueryCacher.get(async () => {
        const result = await db.prepare(
            "get",
            'SELECT "feature" from "userFeatures" WHERE "userID" = ? AND "feature" = ?',
            [userID, feature],
            { useReplica: true }
        );
        return !!result;
    }, userFeatureKey(userID, feature));
}
