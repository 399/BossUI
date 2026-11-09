# BossUI

内部 SaaS 设计规范站，纯 HTML / CSS / JavaScript + Markdown，无框架或第三方依赖。

目前仅两篇已获授权规范：“通知时间展示规则” `index.html#/doc/time`、“搜索框” `index.html#/doc/search`。首页保留基础样式、设计规范、模板三个入口；基础样式和模板显示“暂无内容”。

shadcn/ui 仅作为本站视觉风格参考，不构成产品规范授权。其他内容须由用户逐项定义，不因参考或读到就自动纳入。

## 维护

正文源为 `docs/time.md`、`docs/search.md`，索引为 `docs/manifest.json`。搜索框只展示重点，末尾相对链接直接打开 `docs/后台列表搜索能力设计标准.md` 原始全文；该原文不列为第三篇规范，其中 Agent 执行流程不构成线上访问授权。修改后运行 `scripts/build.py`，生成 `assets/content.js`；不要只修改生成物。直接打开 `index.html` 或使用普通静态服务器浏览。

在本目录运行（Python 标准库，无需安装依赖）：

```sh
/Users/a399/.workbuddy/binaries/python/versions/3.13.12/bin/python3 -B scripts/build.py
node --test tests/core.test.js
/Users/a399/.workbuddy/binaries/python/versions/3.13.12/bin/python3 -B tests/test_build.py
```

本次检查范围见 `checks/acceptance.md`，实际结果见 `checks/verification.md`。
