import RPCClient from "@alicloud/pop-core";
import { ApiQueue } from "./ApiRateQueue";
import { config } from "../../config";

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

export class ContentModerationApi {
    static apiQueue = new ApiQueue(1000, 100);

    private static client = new RPCClient({
        accessKeyId: config.ContentCheckApiKey,
        accessKeySecret: config.ContentCheckApiSecret,
        endpoint: "https://green-cip.cn-shanghai.aliyuncs.com",
        apiVersion: "2022-03-02",
    });

    public static checkNickname(nickname: string): Promise<boolean> {
        return ContentModerationApi.apiQueue.callApi(nickname, () => ContentModerationApi.checkNicknameProcess(nickname));
    }

    private static async checkNicknameProcess(nickname: string): Promise<boolean> {
        const params = {
            Service: "nickname_detection",
            ServiceParameters: JSON.stringify({
                content: nickname,
            }),
        };
        const res = (await ContentModerationApi.client.request("TextModeration", params, requestOption)) as ApiResponse;
        if (res.Code == 200) {
            return res?.Data?.labels == "";
        } else {
            throw new Error(res.Message);
        }
    }
}
