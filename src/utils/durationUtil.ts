import { VideoDuration } from "../types/segments.model";

export const ISODurationRegex = new RegExp(
    /P(?:([\d.]+)Y)?(?:([\d.]+)M)?(?:([\d.]+)W)?(?:([\d.]+)D)?T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?/
);

export function parseISODurationToSeconds(duration: string): number | null {
    const matches = duration.match(ISODurationRegex);
    if (matches) {
        const years = parseFloat(matches[1]) || 0;
        const months = parseFloat(matches[2]) || 0;
        const weeks = parseFloat(matches[3]) || 0;
        const days = parseFloat(matches[4]) || 0;
        const hours = parseFloat(matches[5]) || 0;
        const minutes = parseFloat(matches[6]) || 0;
        const seconds = parseFloat(matches[7]) || 0;

        return (
            years * 31536000 + months * 2628000 + weeks * 604800 + days * 86400 + hours * 3600 + minutes * 60 + seconds
        );
    }
    return null;
}

export function parseISODurationToVideoDuration(duration: string): VideoDuration | null {
    return parseISODurationToSeconds(duration) as VideoDuration;
}

export function durationEquals(d1: number | VideoDuration, d2: number | VideoDuration, tolerance = 2): boolean {
    return Math.abs(d1 - d2) < tolerance;
}

export function durationsAllEqual(durations: number[], tolerance = 2): boolean {
    if (durations.length < 2) {
        return true;
    }
    return Math.max(...durations) - Math.min(...durations) < tolerance;
}
