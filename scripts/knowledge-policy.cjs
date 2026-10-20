// This is a packaging policy, not an agent router. Legacy directory names stay compatible.
const SHARED = [
 'account_stats.py','bili_login.py','business_browser.py','calendar_ops.py','content_guard.py','human_pace.py','creator_auth.py','profile_lock.py',
 'login_state.py','login_qr.py','manifest.py','output_paths.py','persona_gate.py','platform_readback.py','profile_files.py',
 'social_stats.py','weixin_mp_stats.py','wordcount.py','xhs_comment.py','xhs_publish.py',
 'zhihu_answer.py','zhihu_comments_fetch.py','web_publisher.py','douyin_publish.py'
];
const LOCAL = {
 'asset-manager':['assets.py'], 'template-library':['templates.py'], 'roi-calculator':['calc.py'],
 'skill-bilibili-upload':['bili_upload.py'], 'skill-comment-insights':['comment_insights.py'],
 'skill-content-postmortem':['aggregate.py'], 'skill-cross-platform-publish':['publish_dispatch.py'],
 'skill-data-tracker':['track.py'], 'skill-event-calendar':['lunar.py'],
 'skill-news-intelligence':['daily_briefing.py','fetch_news.py','rss_parser.py'],
 'skill-post-scorer':['score.py'], 'skill-publish-analytics':['analyze.py'],
 'skill-publish-log':['log.py'], 'skill-publish-notify':['notify.py'],
 'skill-publish-scheduler':['publish_queue.py'], 'skill-rss-aggregator':['rss_digest.py'],
 'skill-short-link':['shortlink.py'], 'skill-social-performance-review':['review.py'],
 // ai_score is a deterministic regex/statistics diagnostic, not a model call.
 // multi_publish is an optional external Wechatsync adapter, never an installed Node dependency.
 'skill-wechat-publisher':['api.py','ai_score.py','config.py','html_converter.py','image_handler.py',
   'multi_publish.py','newspic_build.py','publish.py','wechat_api.py','wechat_token.py']
};
const BUSINESS = new Set([
 ...Object.keys(LOCAL), 'skill-account-diagnosis','skill-algorithm-updates','skill-audience-profiler',
 'skill-brand-onboarding','skill-campaign-planner','skill-channels-upload','skill-collab-proposal',
 'skill-community-ops','skill-competitor-analysis','skill-content-calendar','skill-content-calendar-log',
 'skill-content-gap-analysis','skill-content-matrix','skill-content-strategy','skill-cross-platform-diff',
 'skill-douyin-upload','skill-kuaishou-upload','skill-livestream','skill-my-account','skill-persona-check',
 'skill-positioning-analysis','skill-profile-builder','skill-profile-manager','skill-publish-checklist',
 'skill-quality-gate','skill-risk-scanner','skill-seo-quality','skill-strategy-advisor','skill-topic-evaluator',
 'skill-trend-rider','skill-trending-topics','skill-ugc-discovery','skill-voice-builder','skill-xhs-analyzer',
 'skill-xhs-comment-reply','skill-xhs-publisher','skill-zhihu-answer','skill-zhihu-publisher'
]);
// Pure general-purpose tools are no longer product entries. Mixed methods such
// as editing, shot design, subtitles, narrative and platform formats stay.
const RETIRED_SKILLS = new Set([
 'ai-image-gen','ai-video-gen','ai-music','audio-denoise','audio-editing','audio-mix',
 'audio-visualizer','batch-process','doc-convert','green-screen','image-editing',
 'image-enhance','remove-bg','voice-clone','tts-voiceover','multi-voice-dubbing',
 'style-transfer','meme-generator','mindmap'
]);
const keptScripts = [
 ...SHARED.map(n=>'skills/shared/scripts/'+n),
 ...Object.entries(LOCAL).flatMap(([name, files])=>files.map(f=>'skills/openclaw/'+name+'/scripts/'+f))
];
module.exports={SHARED,LOCAL,BUSINESS,RETIRED_SKILLS,keptScripts};
