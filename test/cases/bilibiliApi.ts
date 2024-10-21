import assert from "assert";
import { BilibiliAPI } from "../../src/utils/bilibiliApi";
import { getVideoDetails } from "../../src/utils/getVideoDetails";
import { partialDeepEquals } from "../utils/partialDeepEquals";

const videoID = "BV1Js411o76u";
const expectedBilibili = {
    bvid: videoID,
    title: "【炮姐/AMV】我永远都会守护在你的身边！",
    pubdate: 1382776414,
    duration: 689,
    owner: {
        mid: 888465,
    },
    cid: 1176840,
};
const currentViews = 25109018;

describe("Bilibili API test", function () {
    it("should be able to get Bilibili details", async () => {
        const result = await BilibiliAPI.getVideoDetailView(videoID);
        assert.ok(partialDeepEquals(result, expectedBilibili));
    });
    it("Should have more views than current", async () => {
        const result = await BilibiliAPI.getVideoDetailView(videoID);
        assert.ok(Number(result.stat.view) >= currentViews);
    });
    it("Should return data from generic endpoint", async function () {
        const videoDetail = await getVideoDetails(videoID);
        assert.ok(videoDetail);
    });
});
