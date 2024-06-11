import axios from "axios";
import { Logger } from "../utils/logger";

export const getEdgeUsers = (extID: string): Promise<number | undefined> =>

    axios.get(`https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${extID}`)
        .then(res => res.data.activeInstallCount)
        .catch((err) => {
            Logger.error(`Error getting Edge users - ${err}`);
            return 0;
        });

export function getChromeUsers(extID: string): Promise<number | undefined> {
    return axios
        .get(`https://img.shields.io/chrome-web-store/users/${extID}`)
        .then((res) => {
            const match = res.data.match(/"users: ?([0-9,]+)"/)?.[1];
            if (match) {
                return parseInt(match.replace(/,/g, ""));
            }
        })
        .catch(() => {
            Logger.debug(`Failing to get user count of the Chrome Web Store: ${extID}`);
            return 0;
        });
}