import { Request } from "express";
import { ActionType, Category, SegmentUUID, Service } from "../types/segments.model";
import { getService } from "./getService";

import { ALL_ACTION_TYPES, ALL_CATEGORIES } from "./constant";
import { parseActionTypes, parseCategories, parseRequiredSegments } from "./parseParams";

const errorMessage = (parameter: string) => `${parameter} parameter does not match format requirements.`;

export function parseSkipSegments(req: Request): {
    categories: Category[];
    actionTypes: ActionType[];
    requiredSegments: SegmentUUID[];
    service: Service;
    errors: string[];
} {
    const categories: Category[] = parseCategories(req, ALL_CATEGORIES);
    const actionTypes: ActionType[] = parseActionTypes(req, ALL_ACTION_TYPES);
    const requiredSegments: SegmentUUID[] = parseRequiredSegments(req);
    const service: Service = getService(req.query.service, req.body.services);
    const errors: string[] = [];
    if (!Array.isArray(categories)) errors.push(errorMessage("categories"));
    else if (categories.length === 0) errors.push("No valid categories provided.");

    if (!Array.isArray(actionTypes)) errors.push(errorMessage("actionTypes"));
    if (!Array.isArray(requiredSegments)) errors.push(errorMessage("requiredSegments"));
    // finished parsing
    return {
        categories,
        actionTypes,
        requiredSegments,
        service,
        errors,
    };
}
