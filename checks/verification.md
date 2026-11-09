# 本次验证

范围：通知时间说明移除、搜索框重点接入、原始 Markdown 相对链接；本地构建、静态测试及主 Agent 的 Neo 浏览器核验。

## 静态结果

本轮执行并全部通过（下列为项目内命令）：

```sh
/Users/a399/.workbuddy/binaries/python/versions/3.13.12/bin/python3 -B scripts/build.py
node --test tests/core.test.js
/Users/a399/.workbuddy/binaries/python/versions/3.13.12/bin/python3 -B tests/test_build.py
node --check assets/app.js
node --check assets/markdown.js
node --check assets/content.js
```

- 构建：2 篇文档，manifest 与生成内容一致，展示正文分别等于 `docs/time.md`、`docs/search.md`。
- Node：20/20 通过。覆盖首页三入口、两篇索引/目录/搜索、空栏目、时间表格及计算段逐字核对且无来源说明、搜索重点、原文直接相对 href、HTTP / file URL 解析、链接白名单、路径穿越拒绝及旧路由不存在。
- Python：12/12 通过。覆盖两篇构建、转义、路径限制、重复 ID、资源引用、无网络调用、构建确定性，以及 `sourceFile` 类型/路径/存在性/扩展名/符号链接越界校验。测试夹具只驻留内存。
- JavaScript：3 个站点脚本语法检查通过。
- 原文仍为 `docs/后台列表搜索能力设计标准.md`，7675 字节，SHA-256 为 `e75307ed2b05615356115adbd892f3f7f1ede790070d98941d5057b9665f0eb5`；未写入原文，未登记为第三篇规范或纳入全文搜索。
- 三份 Markdown 正文均只读；未改 `index.html`、`assets/site.css` 或 `assets/markdown.js`，未增加依赖、业务规则或组件演示。

## 浏览器

主 Agent 本轮通过 Neo 实测：

- 首页、目录及搜索索引只有通知时间和搜索框两篇；基础样式、模板仍显示暂无内容。
- 通知时间只有规则表格与计算说明，没有来源、读取日期或 revision。
- 搜索框展示类型与控件对照、合并拆分、多选“所有”、字段说明格式；未添加源文档之外的输入长度或文本域尺寸规则。
- 点击原文链接，HTTP 与 file 两种方式均实际打开原路径 Markdown，首尾正文中文可读。
- 初次 HTTP 打开原文时因预览服务器未声明字符集而乱码。已将本轮本机预览服务的 .md 响应设为 text/plain; charset=utf-8，禁用旧缓存后复验 UTF-8 正常；原始文件字节未改变。后续静态部署也应为 Markdown 声明 UTF-8。
- 搜索框页面在1440px与390px检查无整页横向溢出。

本轮未重新实测复制的剪贴板内容、下载按钮、1024px布局及控制台；不沿用旧结论。

实施者未访问浏览器、飞书或 BOSS，未从原文中的 Agent 流程推导线上访问授权。
