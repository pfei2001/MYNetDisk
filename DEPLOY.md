# mynetdisk 部署指南（Cloudflare）

从零开始把 mynetdisk 部署到 Cloudflare 上，大约需要 15–20 分钟。

## 架构概览

```
浏览器 ──HTTPS──> Cloudflare Pages（前端 dist + 后端 functions/）
                        │
                        ├── R2 存储桶（绑定名 PICX）：存图片文件
                        ├── D1 数据库（绑定名 DB）：存图片元数据、相册、分享记录
                        └── KV（绑定名 XK）：删除链接 token、上传限流计数
```

图片通过 `https://你的域名/rest/<图片key>` 直接访问（由 Pages Functions 从 R2 读取后返回），**R2 存储桶本身不需要开启公开访问**。

---

## 步骤 1：准备 GitHub 仓库

1. 在 GitHub 新建仓库 `mynetdisk`（或 fork 现有仓库）。
2. 把本项目代码推送到该仓库的 `main` 分支：
   ```bash
   git remote add origin https://github.com/<你的用户名>/mynetdisk.git
   git push -u origin main
   ```

## 步骤 2：创建 R2 存储桶

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 左侧 **R2 对象存储** → **创建存储桶**。
2. 存储桶名称填写 `mynetdisk`（名称记下来，后面绑定用）。
3. 其他保持默认，点击创建。

## 步骤 3：创建 KV 命名空间

1. 左侧 **Workers 和 Pages** → **KV** → **创建命名空间**。
2. 名称填写 `mynetdisk-kv`，把分配到的 **ID** 记下来。

## 步骤 4：创建 D1 数据库并建表

1. 左侧 **Workers 和 Pages** → **D1 SQL 数据库** → **创建**，名称填写 `mynetdisk-db`，把 **数据库 ID** 记下来。
2. 进入该数据库 → **控制台**，把本仓库 `migrations/0001_init.sql` 的全部内容复制进去执行。
   - 也可以用 wrangler 命令行执行：
     ```bash
     npx wrangler d1 execute mynetdisk-db --file=./migrations/0001_init.sql
     ```
3. 建表成功后会有 `users`、`images`、`shares`、`albums`、`album_images`、`album_shares`、`api_keys`、`audit_logs`、`system_settings` 共 9 张表。

## 步骤 5：创建 Pages 项目并关联仓库

1. 左侧 **Workers 和 Pages** → **创建** → **Pages** → **连接到 Git**，选择你的 `mynetdisk` 仓库。
2. 构建配置：
   - **构建命令**：`npm run build`
   - **构建输出目录**：`dist`
   - Node 版本建议 20+（Cloudflare 默认即可）。
3. 先不要点部署，切到下面的绑定和变量配置。

## 步骤 6：绑定 R2 / D1 / KV

在 Pages 项目的 **设置 → 绑定** 中添加：

| 类型 | 变量名（绑定名） | 值 |
|---|---|---|
| R2 存储桶 | `PICX` | 步骤 2 创建的 `mynetdisk` 存储桶 |
| D1 数据库 | `DB` | 步骤 4 创建的 `mynetdisk-db` |
| KV 命名空间 | `XK` | 步骤 3 创建的 `mynetdisk-kv` |

> 注意：绑定名必须 exactly 是 `PICX` / `DB` / `XK`，代码里写死了这几个名字。

## 步骤 7：配置环境变量

在 Pages 项目的 **设置 → 环境变量** 中添加（Production 和 Preview 都建议配）：

| 变量名 | 说明 | 示例 |
|---|---|---|
| `ADMIN_PASSWORD` | **必填**。登录密码，请设置一个强密码 | `your-password-here`（换成你自己的） |
| `BASE_URL` | 你的 Pages 访问域名，用于生成分享链接 | `https://mynetdisk.pages.dev` |

可选变量（Hugging Face 存储，不用可不填）：

| 变量名 | 说明 |
|---|---|
| `HF_TOKEN` | Hugging Face Token |
| `HF_REPO` | Hugging Face 仓库（`用户名/仓库名`） |
| `STORAGE_TYPE` | 默认存储，`R2` 或 `HF`（默认 `R2`） |

> ⚠️ 不要把真实密码写进代码仓库，只放在 Cloudflare 的环境变量里。

## 步骤 8：部署并验证

1. 点击 **保存并部署**，等待构建完成。
2. 访问分配的 `https://<项目名>.pages.dev`，会看到密码登录页。
3. 输入 `ADMIN_PASSWORD` 登录，看到图片管理页即成功。
4. 上传一张测试图片，复制链接在新窗口打开，能正常显示即全部正常。

## 步骤 9（可选）：绑定自定义域名

1. Pages 项目 → **自定义域** → **设置自定义域**，输入你的域名（如 `img.example.com`）。
2. 按提示在 DNS 处添加 CNAME 记录，等待证书签发即可。
3. 绑定后记得把环境变量 `BASE_URL` 改成自定义域名，否则分享链接用的还是 pages.dev 域名。

---

## 会话与安全说明

- 登录成功后，后端通过 **httpOnly cookie**（`mynetdisk_session`）维持会话，前端 JS 读不到 cookie 内容，相对安全。
- session 是用 `ADMIN_PASSWORD` 做 HMAC-SHA256 签名的 token，**修改密码后所有已登录会话自动失效**。
- 会话有效期默认 30 天，可在管理页「系统设置」里调整。
- 所有管理 API 都要求有效会话；图片分享链接（`/s/…`）、删除链接（`/delete/…`）按原设计保持公开访问。

## 常见问题

- **登录页提示"ADMIN_PASSWORD is not configured"**：环境变量没配好，检查 Pages 设置 → 环境变量，确认 Production 环境有 `ADMIN_PASSWORD`，然后重新部署。
- **上传失败**：检查 R2 绑定名是否为 `PICX`，存储桶是否存在。
- **页面空白/接口 500**：检查 D1 绑定名是否为 `DB`，以及是否执行了 `migrations/0001_init.sql` 建表。
- **图片打不开**：确认访问的是 `https://你的域名/rest/<key>` 格式的链接；R2 存储桶不需要开公开访问。
