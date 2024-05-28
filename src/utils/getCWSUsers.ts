import axios from "axios";
import { Logger } from "../utils/logger";

export const getEdgeUsers = (extID: string): Promise<number | undefined> =>

    axios.get(`https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${extID}`)
        .then(res => res.data.activeInstallCount)
        .catch((err) => {
            Logger.error(`Error getting Edge users - ${err}`);
            return 0;
        });

/* istanbul ignore next */
export function getChromeUsers(chromeExtensionUrl: string): Promise<number> {
    return axios.get(chromeExtensionUrl)
        .then(res => {
            const body = res.data;
            const match = body.match(/>([\d,]+) users</)?.[1];
            if (match) {
                return parseInt(match.replace(/,/g, ""));
            }
        })
        .catch(/* istanbul ignore next */ () => {
            Logger.debug(`Failing to connect to ${chromeExtensionUrl}`);
            return 0;
        });
}