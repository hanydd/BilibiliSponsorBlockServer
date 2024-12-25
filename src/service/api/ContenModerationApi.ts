import RPCClient from "@alicloud/pop-core";
import { config } from "../../config";
import { Logger } from "../../utils/logger";
import { ApiQueue } from "./ApiRateQueue";

interface ApiResponse {
    RequestId: string;
    Message: string;
    Data: {
        reason: string;
        labels: string;
    };
    Code: number;
}

const requestOption = {
    method: "POST",
    formatParams: false,
};

const url = "https://green-cip.cn-shanghai.aliyuncs.com";

export class ContentModerationApi {
    private static client: RPCClient = null;
    static {
        try {
            this.client = new RPCClient({
                accessKeyId: config.ContentCheckApiKey,
                accessKeySecret: config.ContentCheckApiSecret,
                endpoint: url,
                apiVersion: "2022-03-02",
            });
        } catch (err) {
            Logger.error(`Failed to create Ali ContentModeration client: ${err}`);
        }
    }

    static apiQueue = new ApiQueue(5000, 500);

    public static async checkNickname(nickname: string): Promise<boolean> {
        if (this.client == null) {
            Logger.warn(`Skipping nickname check, client not initialized! ${nickname}`);
            return true;
        }
        return await ContentModerationApi.apiQueue.callApi(nickname, () => ContentModerationApi.checkNicknameProcess(nickname));
    }

    private static async checkNicknameProcess(nickname: string): Promise<boolean> {
        const params = {
            Service: "nickname_detection",
            ServiceParameters: JSON.stringify({ content: nickname }),
        };
        Logger.info(`Checking nickname ${nickname} using Service: ${url}`);
        const res = (await ContentModerationApi.client.request("TextModeration", params, requestOption)) as ApiResponse;
        if (res.Code == 200) {
            return res?.Data?.labels == "";
        } else {
            throw new Error(res.Message);
        }
    }
}
