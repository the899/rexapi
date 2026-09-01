说伴
上海初一家中英语口语陪练。电脑演 A，学生当 B。
React 单页，可放到 Cloudflare Pages。

打开：用静态服务器或上传 Pages。需要 https 或本机服务才能用麦克风。不要直接双击 html。

学生路径：选课 → 开场 → 对话 → 回放。家长可布置主题、开口次数、目标档。
朗读 POST https://tts.a1b2.cc ，识别 POST https://tts.a1b2.cc/asr ，同一把百炼 Key。请求头带 X-Shuoban-Key，对应 Worker 加密变量 SHUOBAN_GATE。失败才退回浏览器朗读/打字。
Pages：构建命令留空，本目录即成品。
