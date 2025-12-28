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