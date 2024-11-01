import { config } from "../config";

interface ValidationResult {
    pass: boolean;
    errorMessage?: string;
}

function pass(): ValidationResult {
    return { pass: true };
}

function fail(errorMessage: string): ValidationResult {
    return { pass: false, errorMessage: errorMessage };
}

export function validateCid(cid: string) {
    if (!cid || /^[1-9]\d*$/.test(cid)) {
        return pass();
    }
    return fail("cid有误");
}

export function validatePrivateUserID(userID: string): ValidationResult {
    const minLength = config.minUserIDLength;
    if (typeof userID !== "string") {
        return fail("私人用户ID有误");
    }
    if (userID?.length < minLength) {
        return fail(`私人用户ID至少 ${minLength} 个字符长`);
    }
    return pass();
}
