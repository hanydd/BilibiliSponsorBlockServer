import axios from "axios";
import { Logger } from "../utils/logger";

export const getEdgeUsers = (extID: string): Promise<number | undefined> =>
    axios
        .get(`https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${extID}`)
        .then((res) => res.data.activeInstallCount)
        .catch((err) => {
            Logger.error(`Error getting Edge users - ${err}`);
            return 0;
        });

const chromeUserRegex = /<title>users: (([\d,]+?)|([\d,]+?k))<\/title>/;
export function getChromeUsers(extID: string): Promise<number | undefined> {
    return axios
        .get(`https://img.shields.io/chrome-web-store/users/${extID}`)
        .then((res) => {
            const match = res.data.match(chromeUserRegex);
            if (match && match[2]) {
                return parseInt(match[2].replace(/,/g, ""));
            } else if (match && match[3]) {
                return parseInt(match[3].replace(/,|k/g, "")) * 1000;
            }
        })
        .catch(() => {
            Logger.debug(`Failing to get user count of the Chrome Web Store: ${extID}`);
            return 0;
        });
}
