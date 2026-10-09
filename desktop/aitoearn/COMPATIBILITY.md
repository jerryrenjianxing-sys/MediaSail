# AitoEarn China website adapter

Observed 2026-10-09 on https://aitoearn.cn and its publicly served scripts.
This is a website-session integration, not a promise of a stable public draft API.

- The browser stores the signed-in user in `localStorage.User`, with a Zustand
  `state` containing `token` and `userInfo.id`. The API uses a bearer Authorization
  header; `GET /api/user/mine` confirms the actual account.
- List draft boxes with `GET material/group/list/{page}/100`; create with
  `POST material/group`, `{ name, type: "video" }`. This matches the website's
  generic draft-box creation, including boxes holding image/text drafts.
- Upload: `POST assets/uploadSign`, PUT the file to the signed URL, then
  `POST assets/{id}/confirm`. The China media origin is `assets.aitoearn.cn`.
- Draft: `POST material`, `{groupId,title,desc,type,accountTypes,mediaList,coverUrl}`.
  Types are `article` (image/text) and `video`; media types are `img` and `video`.
  The original form accepts an empty `accountTypes` list. No social account is
  selected by the import operation. `GET material/list/{page}/100?groupId=...`
  is used to reconcile ambiguous creation results.
- Live Electron verification found `/zh` redirects to the nonexistent `/zh-CN/zh`.
  The valid Chinese locale is `/zh-CN`; draft box links use `/zh-CN/draft-box?planId=...`. A draft card is
  located by its exact title and cover, and opened only when the match is unique.
  If its markup changes, the saved draft remains accessible in that box.

Evidence scripts at inspection time (served by the website, not bundled):
`432cjl7ac1hnb.js` (session/request client), `0fz75k6gfklh8.js` (upload/material APIs),
`2-yg1g_o06zzm.js` (draft form/card), `25ob3nsd7z-bq.js` (draft box link).
All were under `https://aitoearn.cn/_next/static/chunks/`.

The published API documents cover uploads and real publishing flows, but did not
list a separate draft-creation API at inspection time:
https://docs.aitoearn.cn/llms.txt
https://docs.aitoearn.cn/477787206e0.md
https://docs.aitoearn.cn/477787207e0.md

On incompatible auth, API shape, media origin or upload method, stop and retain the
local pending content. Do not fall back to publishing endpoints or browser token
export. Only new user actions may resume an uncertain transfer after reconciliation.
