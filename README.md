# 编译

```
npm install
npm install -g typescript
```

```
tsc -noEmit -skipLibCheck && node esbuild.config.mjs production -v
```

# 安装

```
main.js
manifest.json
styles.css
```

将编译产物放在:

```
你的库库名/.obsidian/plugins/media-notes/
```

# 支持的媒体

在笔记 frontmatter 中写 `media_link`（或 `media`）。插件会根据链接自动选择播放器：

```yaml
---
media_link: https://www.youtube.com/watch?v=dQw4w9WgXcQ
---
```

```yaml
---
media_link: 附件/英语听力.mp3
---
```

```yaml
---
media_link: [[附件/采访.mp4]]
---
```

也支持 `file://` 绝对路径、普通绝对路径（如 `/Users/me/Documents/audio.mp3`）、`app://` 资源路径和直链 `https://.../audio.mp3`。vault 外的文件由插件用 Node 读取并转成 blob URL 播放（Electron 会拦截裸 `file://`），因此不需要先把媒体复制进 vault。太大的视频文件会整块读进内存，建议放在 vault 内以走 `app://`。

- 音频：`.mp3` `.m4a` `.aac` `.wav` `.flac` `.opus` `.oga` `.mp4a`
- 视频：`.mp4` `.m4v` `.mov` `.webm` `.ogv` `.mkv` `.avi`

音频使用浏览器原生控件；视频与 YouTube 一样使用插件的快捷键、进度条和时间戳浮层。链接里带 `?t=30` 或 `#t=1m30s` 会从指定时间开始播放；本地文件的 `t` 参数同样有效。

所有命令（Insert Timestamp、Play/Pause、Fast Forward、Rewind、Speed up、Slow down）对 YouTube 和本地媒体都生效。点击笔记中的时间戳可以跳转播放位置。
