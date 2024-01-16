import { BilibiliVideoDimension } from "./bilibiliCommonApi.model";
import { BilibiliPagelistDetail } from "./bilibiliPagelist.model";

// https://api.bilibili.com/x/web-interface/view
export interface BilibiliVideoDetailViewResponse {
    code: number;
    message: string;
    ttl: number;
    data?: BilibiliVideoDetailView;
}

export interface BilibiliVideoDetailView {
    bvid: string;
    aid: number;
    videos: number;
    tid: number;
    tname: string;
    copyright: number;
    pic: string;
    title: string;
    pubdate: number;
    ctime: number;
    desc: string;
    desc_v2: {
        raw_text: string;
        type: number;
        biz_id: number;
    }[];
    state: number;
    duration: number;
    forward: number | null;
    mission_id: number;
    redirect_url: string | null;
    rights: Rights;
    owner: BilibiliOwner;
    stat: Stat;
    argue_info: ArgueInfo;
    dynamic: string;
    cid: number;
    dimension: BilibiliVideoDimension;
    season_id: number;
    premiere: any | null;
    teenage_mode: number;
    is_chargeable_season: boolean;
    is_story: boolean;
    is_upower_exclusive: boolean;
    is_upower_play: boolean;
    is_upower_preview: boolean;
    enable_vt: number;
    vt_display: string;
    no_cache: boolean;
    pages: BilibiliPagelistDetail[];
    subtitle: Subtitle;
    staff: BilibiliStaff[];
    ugc_season: UgcSeason;
    is_season_display: boolean;
    user_garb: {
        url_image_ani_cut: string;
    };
    honor_reply: any;
    like_icon: string;
    need_jump_bv: boolean;
    disable_show_up_info: boolean;
    is_story_play: number;
}


/**
 * uploader of videos
 */
export interface BilibiliOwner {
    mid: number;
    name: string;
    face: string;
}

/**
 * other uploaders in a colaboration video
 */
export interface BilibiliStaff extends BilibiliOwner {
    title: string;
    vip: Vip;
    official: {
        role: number;
        title: string;
        desc: string;
        type: number;
    };
    follower: number;
    label_style: number;
}


interface Vip {
    type: number;
    status: number;
    due_date: number;
    vip_pay_type: number;
    theme_type: number;
    label: {
        path: string;
        text: string;
        label_theme: string;
        text_color: string;
        bg_style: number;
        bg_color: string;
        border_color: string;
        use_img_label: boolean;
        img_label_uri_hans: string;
        img_label_uri_hant: string;
        img_label_uri_hans_static: string;
        img_label_uri_hant_static: string;
    };
    avatar_subscript: number;
    nickname_color: string;
    role: number;
    avatar_subscript_url: string;
    tv_vip_status: number;
    tv_vip_pay_type: number;
    tv_due_date: number;
    avatar_icon: {
        icon_resource: any;
    };
}

interface Subtitle {
    allow_submit: boolean;
    list: {
        id: {
            value: string;
            type: string;
        };
        lan: string;
        lan_doc: string;
        is_lock: boolean;
        subtitle_url: string;
        type: number;
        id_str: string;
        ai_type: number;
        ai_status: number;
        author: {
            mid: number;
            name: string;
            sex: string;
            face: string;
            sign: string;
            rank: number;
            birthday: number;
            is_fake_account: number;
            is_deleted: number;
            in_reg_audit: number;
            is_senior_member: number;
        };
    }[];
}

interface ArgueInfo {
    argue_msg: string;
    argue_type: number;
    argue_link: string;
}

interface Stat {
    aid: number;
    view: number;
    danmaku: number;
    reply: number;
    favorite: number;
    coin: number;
    share: number;
    now_rank: number;
    his_rank: number;
    like: number;
    dislike: number;
    evaluation: string;
    vt: number;
}

interface Rights {
    bp: number;
    elec: number;
    download: number;
    movie: number;
    pay: number;
    hd5: number;
    no_reprint: number;
    autoplay: number;
    ugc_pay: number;
    is_cooperation: number;
    ugc_pay_preview: number;
    no_background: number;
    clean_mode: number;
    is_stein_gate: number;
    is_360: number;
    no_share: number;
    arc_pay: number;
    free_watch: number;
}

interface UgcSeason {
    id: number;
    title: string;
    cover: string;
    mid: number;
    intro: string;
    sign_state: number;
    attribute: number;
    sections: {
        season_id: number;
        id: number;
        title: string;
        type: number;
        episodes: {
            season_id: number;
            section_id: number;
            id: number;
            aid: number;
            cid: number;
            title: string;
            attribute: number;
            arc: {
                aid: number;
                videos: number;
                type_id: number;
                type_name: string;
                copyright: number;
                pic: string;
                title: string;
                pubdate: number;
                ctime: number;
                desc: string;
                state: number;
                duration: number;
                rights: {
                    bp: number;
                    elec: number;
                    download: number;
                    movie: number;
                    pay: number;
                    hd5: number;
                    no_reprint: number;
                    autoplay: number;
                    ugc_pay: number;
                    is_cooperation: number;
                    ugc_pay_preview: number;
                    arc_pay: number;
                    free_watch: number;
                };
                author: {
                    mid: number;
                    name: string;
                    face: string;
                };
                stat: {
                    aid: number;
                    view: number;
                    danmaku: number;
                    reply: number;
                    fav: number;
                    coin: number;
                    share: number;
                    now_rank: number;
                    his_rank: number;
                    like: number;
                    dislike: number;
                    evaluation: string;
                    argue_msg: string;
                    vt: number;
                    vv: number;
                };
                dynamic: string;
                dimension: BilibiliVideoDimension;
                desc_v2: any;
                is_chargeable_season: boolean;
                is_blooper: boolean;
                enable_vt: number;
                vt_display: string;
            };
            page: {
                cid: number;
                page: number;
                from: string;
                part: string;
                duration: number;
                vid: string;
                weblink: string;
                dimension: BilibiliVideoDimension;
            };
            bvid: string;
        }[];
    }[];
    stat: {
        season_id: number;
        view: number;
        danmaku: number;
        reply: number;
        fav: number;
        coin: number;
        share: number;
        now_rank: number;
        his_rank: number;
        like: number;
        vt: number;
        vv: number;
    };
    ep_count: number;
    season_type: number;
    is_pay_season: boolean;
    enable_vt: number;
}
