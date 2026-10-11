<p align="center">
  <img src="docs/favicon.ico" alt="mynetdisk" width="120" height="120">
</p>

<h1 align="center">mynetdisk</h1>

<p align="center">
  <strong>🖼️ 基于 Cloudflare（Pages + Functions + R2 + D1 + KV）的精简个人图床，单用户密码保护</strong>
</p>

---

## 📌 项目来源

本项目基于开源项目 [roim-picx](https://github.com/roimdev/roim-picx)（作者 roimdev，Apache-2.0 协议）精简改造，原 LICENSE 文件保留。感谢原作者的出色工作。

## ✨ 功能列表

- 📦 图片批量上传（支持拖拽、粘贴、压缩）
- 🖼️ 图片列表管理：删除、重命名、目录分类、标签、搜索
- 📎 上传链接一键复制
- ⏰ 文件过期自动删除
- 📂 相册管理：创建相册、添加图片、公开 / 加密分享
- 🔗 图片分享链接（可设密码、过期时间、最大访问次数）
- 🗑️ 删除链接（一键删除图片，无需登录）
- 🔑 API Keys（可用于 PicGo 等第三方工具上传）
- 📱 移动端自适应
- 🌗 浅色 / 深色主题切换（导航栏按钮，自动跟随系统，可手动切换并记住选择）
- 🔒 单密码登录保护（密码通过环境变量 `ADMIN_PASSWORD` 配置）

## 🔀 与原版的差异

| 项目 | 原版 roim-picx | 本项目 mynetdisk |
|---|---|---|
| 登录方式 | Token / GitHub / Steam / Google OAuth | 单密码（`ADMIN_PASSWORD` 环境变量） |
| 会话机制 | localStorage 存 JWT | httpOnly cookie + HMAC 签名 session，前端不接触 token |
| 访问统计与热度分析 | 有（image_stats 表 + 分析页） | 已删除 |
| NSFW 内容检测 | 有（浏览器端 nsfwjs 模型） | 已删除 |
| 文本水印 | 有 | 已删除 |
| 主题切换 | 有 | 保留（导航栏明显按钮 + localStorage 持久化 + 跟随系统） |
| 数据库迁移 | 11 个增量迁移文件 | 合并为单个 `migrations/0001_init.sql` |

## 🚀 部署

完整的从零部署步骤见 **[DEPLOY.md](./DEPLOY.md)**，包括：创建 R2 存储桶、KV、D1 数据库并建表、创建 Pages 项目、绑定资源、配置环境变量、自定义域名。

本地开发：

```bash
npm install
npm run build        # 构建前端
npx wrangler pages dev ./dist  # 本地预览（含 Functions，需先配置好绑定）
```

## 🔐 安全提示

- 不要把真实密码写进代码或文档，只放在 Cloudflare 环境变量 `ADMIN_PASSWORD` 里。
- 修改密码后，所有已登录会话自动失效（session 用密码签名）。
- 会话有效期默认 30 天，可在管理页「系统设置」调整。

## 📄 License

Apache-2.0（继承自 roim-picx），见 [LICENSE](./LICENSE)。
