import { IncomingHttpHeaders } from "http";

export function parseUserAgentFromHeaders(headers: IncomingHttpHeaders): string {
    if (!headers.origin) {
        return "";
    }
    return headers.origin.split("://").at(-1) + (headers["x-ext-version"] ? `/${headers["x-ext-version"]}` : "");
}
