import { Category, ActionType } from "../types/segments.model";

export const ALL_CATEGORIES: Category[] = [
    "sponsor" as Category,
    "selfpromo" as Category,
    "interaction" as Category,
    "intro" as Category,
    "outro" as Category,
    "preview" as Category,
    "music_offtopic" as Category,
    "poi_highlight" as Category,
    "filler" as Category,
    "exclusive_access" as Category,
];

export const ALL_ACTION_TYPES: ActionType[] = [
    "skip" as ActionType,
    "mute" as ActionType,
    "full" as ActionType,
    "poi" as ActionType,
];
