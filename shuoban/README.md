说伴
上海初一家中英语口语陪练。电脑演 A，学生当 B。
React 单页，可放到 Cloudflare Pages。

打开：用静态服务器或上传 Pages。需要 https 或本机服务才能用麦克风。不要直接双击 html。

学生路径：选课 → 开场 → 对话 → 回放。家长可布置主题、开口次数、目标档。
朗读 POST https://tts.a1b2.cc ，识别 POST https://tts.a1b2.cc/asr ，同一把百炼 Key。请求头带 X-Shuoban-Key，对应 Worker 加密变量 SHUOBAN_GATE。只接受 Origin 为 https://a.a1b2.cc 的调用（路径锁不住：跨域 Referer 会被裁成域名）。失败才退回浏览器朗读/打字。
Pages：构建命令留空，本目录即成品。
完整需求见 说伴-需求规格.md。
交付暂定轻量 PWA（manifest + 图标 + 全屏），尚未做；分发仍发链接。

下一版（MVP 之后）
运行时不走 TTS，只留 ASR。对话在 Excel 定稿后，用 CosyVoice 按行生成 mp3，存 Cloudflare R2；客户端只播这些文件。TTS 只出现在题库生产，不出现在孩子手机上。
