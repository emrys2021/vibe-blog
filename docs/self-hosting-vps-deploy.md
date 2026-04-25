# 自建云服务器部署流程

这份文档整理的是把当前博客从 Vercel 托管迁移到自有云服务器后的完整思路：服务器如何运行网站、如何做到 `git push` 后自动构建自动部署，以及 GitHub Actions 在这个流程里负责什么。

## 目标效果

最终希望达到的效果是：

```text
本地修改文章或代码
  ↓
git push 到 GitHub main 分支
  ↓
GitHub Actions 自动触发
  ↓
通过 SSH 登录云服务器
  ↓
服务器拉取最新代码
  ↓
安装依赖、同步文章资源、生成搜索索引、生成字体子集、构建 Next.js
  ↓
重启网站服务
  ↓
Nginx 继续对外提供访问
```

也就是日常发布时只需要执行：

```bash
git push
```

剩下的构建和部署交给自动化流程完成。

## 整体架构

推荐第一版使用：

```text
浏览器
  ↓
域名 DNS
  ↓
云服务器公网 IP
  ↓
Nginx
  ↓
127.0.0.1:3000
  ↓
Next.js production server
```

组件分工：

| 组件 | 作用 |
| --- | --- |
| 云服务器 | 真正运行网站的机器 |
| Nginx | 对外接收 HTTP/HTTPS 请求，反向代理到本机 Next.js |
| Next.js | 运行构建后的博客应用 |
| systemd | 保证 Next.js 服务常驻运行，异常退出后自动重启 |
| GitHub Actions | 在代码更新后触发部署脚本 |
| SSH | GitHub Actions 登录服务器的通道 |

当前项目没有在 `next.config.mjs` 中启用 `output: 'export'`，所以默认部署方式是：

```bash
npm run build
npm run start
```

这仍然可以保留很强的静态化优势，因为文章页面、搜索索引、图片资源、字体子集都在构建阶段生成。区别只是线上由 `next start` 提供服务，而不是直接把 `out/` 目录交给 Nginx。

## 服务器初始化

以下以 Ubuntu 22.04 / 24.04 为例。

### 安装基础工具

```bash
sudo apt update
sudo apt install -y git nginx curl python3-venv python3-pip
```

### 安装 Node.js

建议使用 Node.js 22。

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

确认版本：

```bash
node -v
npm -v
```

### 拉取项目

```bash
cd /home/your-user
git clone https://github.com/emrys2021/vibe-blog.git
cd vibe-blog
```

### 准备字体子集环境

当前项目的 `npm run build` 会自动执行 `npm run font:subset`。这个脚本需要 `pyftsubset`，它来自 Python 的 `fonttools`。

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install fonttools brotli
```

如果服务器不能直接访问 GitHub 下载字体源文件，可以提前把字体源文件放到服务器，并通过环境变量指定：

```bash
export LXGW_WENKAI_SOURCE_FONT=/path/to/LXGWWenKaiScreen.ttf
export JETBRAINS_MONO_SOURCE_FONT=/path/to/JetBrainsMono.ttf
```

### 首次构建

```bash
npm ci
npm run build
```

当前项目的 `prebuild` 会自动执行：

```text
npm run sync:assets
npm run command-menu:index
npm run font:subset
```

对应效果：

| 命令 | 作用 |
| --- | --- |
| `sync:assets` | 把文章同目录的 `attachments/` 同步到 `public/post-assets/` |
| `command-menu:index` | 生成命令面板使用的搜索索引 |
| `font:subset` | 根据站点内容生成霞鹜文楷和 JetBrains Mono 字体子集 |
| `next build` | 构建生产版本网站 |

## systemd 常驻服务

创建服务文件：

```bash
sudo nano /etc/systemd/system/proj-blog.service
```

示例内容：

```ini
[Unit]
Description=proj-blog Next.js site
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/home/your-user/vibe-blog
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable proj-blog
sudo systemctl start proj-blog
```

查看状态：

```bash
sudo systemctl status proj-blog
```

查看日志：

```bash
journalctl -u proj-blog -f
```

## Nginx 反向代理

创建站点配置：

```bash
sudo nano /etc/nginx/sites-available/proj-blog
```

示例内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/proj-blog /etc/nginx/sites-enabled/proj-blog
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

使用 Certbot 自动申请证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

证书续期通常会由 Certbot 自动配置。可以用下面命令测试：

```bash
sudo certbot renew --dry-run
```

## 手动部署流程

在没有自动化之前，手动部署可以这样做：

```bash
cd /home/your-user/vibe-blog
git fetch origin main
git reset --hard origin/main
npm ci
npm run build
sudo systemctl restart proj-blog
```

这组命令就是后面 GitHub Actions 要自动执行的核心逻辑。

## 自动构建自动部署

自动部署建议拆成两部分：

```text
GitHub Actions 负责触发
云服务器负责构建和重启
```

这样做的好处是：

| 方案 | 特点 |
| --- | --- |
| GitHub Actions 在云端构建，再把产物上传服务器 | 更像传统持续集成，但需要处理产物上传、缓存、路径和服务切换 |
| GitHub Actions SSH 到服务器，让服务器自己构建 | 简单直接，服务器可以复用 `.cache/fonts`、`node_modules`、Next.js 构建缓存 |

对当前博客来说，推荐第二种。

## 部署脚本

在服务器项目目录中创建脚本：

```bash
nano /home/your-user/vibe-blog/deploy.sh
```

内容：

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /home/your-user/vibe-blog

git fetch origin main
git reset --hard origin/main

npm ci
npm run build

sudo systemctl restart proj-blog
```

赋予执行权限：

```bash
chmod +x /home/your-user/vibe-blog/deploy.sh
```

手动测试：

```bash
/home/your-user/vibe-blog/deploy.sh
```

如果 `sudo systemctl restart proj-blog` 需要密码，GitHub Actions 会卡住。可以给部署用户配置免密执行这一个命令：

```bash
sudo visudo
```

追加：

```text
your-user ALL=(ALL) NOPASSWD: /bin/systemctl restart proj-blog
```

不同系统里 `systemctl` 路径可能是 `/usr/bin/systemctl`，可以用下面命令确认：

```bash
which systemctl
```

## GitHub Actions 逻辑

GitHub Actions 的本质是：

```text
GitHub 仓库发生事件
  ↓
GitHub 创建一台临时虚拟机
  ↓
虚拟机按 workflow 文件执行步骤
  ↓
执行结果展示在 GitHub Actions 页面
```

在自动部署场景里，事件是：

```text
main 分支收到 push
```

执行动作是：

```text
通过 SSH 登录服务器并运行 deploy.sh
```

## GitHub Secrets

不要把服务器密码、私钥、IP 等敏感信息写进仓库。需要放到 GitHub 仓库的 Secrets。

路径：

```text
GitHub Repository
  → Settings
  → Secrets and variables
  → Actions
  → New repository secret
```

建议配置：

| Secret | 含义 |
| --- | --- |
| `SERVER_HOST` | 云服务器公网 IP 或域名 |
| `SERVER_USER` | SSH 登录用户名 |
| `SERVER_SSH_KEY` | SSH 私钥内容 |

建议单独生成一对部署用 SSH key，不要复用自己的主力私钥：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github-actions-deploy
```

把公钥加入服务器：

```bash
cat ~/.ssh/github-actions-deploy.pub >> ~/.ssh/authorized_keys
```

把私钥内容填入 GitHub 的 `SERVER_SSH_KEY`。

## Workflow 示例

在项目中创建：

```text
.github/workflows/deploy.yml
```

内容：

```yaml
name: Deploy

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            /home/your-user/vibe-blog/deploy.sh
```

提交这个文件后，以后每次 push 到 `main` 都会触发部署。

## 和 Vercel 的区别

| 能力 | Vercel | 自建服务器 |
| --- | --- | --- |
| 自动构建 | 内置 | 用 GitHub Actions 实现 |
| 自动部署 | 内置 | 用 SSH 脚本实现 |
| HTTPS | 内置 | 用 Nginx + Certbot |
| CDN | 内置 | 需要额外接 Cloudflare 等 |
| 访问统计 | Vercel Analytics | Umami、Plausible、Grafana 或自建接口 |
| 性能统计 | Speed Insights | Web Vitals 自采集或第三方服务 |
| 预览部署 | 内置 | 需要额外设计 |
| 运维成本 | 低 | 中等，需要维护服务器 |

自建服务器的优势是自由度高，后续可以继续部署：

| 服务 | 可以实现的效果 |
| --- | --- |
| Umami / Plausible | 类似 Vercel Analytics 的网站访问统计 |
| Grafana | 自定义可观测性面板 |
| Loki / Prometheus | 日志和指标采集 |
| PostgreSQL / ClickHouse | 存储访问事件 |
| Docker Compose | 管理多个服务 |
| Coolify / Dokploy | 更接近 Vercel 的自托管部署平台 |

## 访问统计和 Grafana

如果想实现类似 Vercel 后台的数据统计，可以搭建：

```text
博客页面
  ↓
前端埋点脚本
  ↓
统计 API
  ↓
数据库
  ↓
Grafana 面板
```

需要注意的是，Grafana 更像展示层，不是统计接口本身。它负责从数据源查询并画图。

一个访问事件可以长这样：

```json
{
  "event": "page_view",
  "path": "/posts/example",
  "referrer": "https://example.com",
  "timestamp": "2026-04-25T10:00:00.000Z",
  "language": "zh-CN"
}
```

前端发送事件时应尽量使用异步方式，比如 `navigator.sendBeacon`，避免影响页面加载。

个人博客建议优先采集：

| 数据 | 用途 |
| --- | --- |
| 页面路径 | 看哪些文章访问最多 |
| 来源页面 | 看访问从哪里来 |
| 时间 | 看访问趋势 |
| 设备类型 | 粗略了解桌面端和移动端占比 |
| Web Vitals | 了解真实用户访问性能 |

不建议过度采集用户指纹、完整 IP、精细地理位置等敏感信息。

## 纯静态托管选项

如果以后希望完全不运行 `next start`，可以考虑在 `next.config.mjs` 中启用：

```js
const nextConfig = {
  output: 'export',
};
```

然后构建得到 `out/` 目录，Nginx 直接托管静态文件。

这种方式的优点：

| 优点 | 说明 |
| --- | --- |
| 运行时更简单 | 不需要 Node.js 服务常驻 |
| 稳定性高 | Nginx 直接返回文件 |
| 资源占用低 | 没有 Next.js server 进程 |

需要确认的点：

| 检查项 | 原因 |
| --- | --- |
| 动态路由是否都能静态生成 | 文章页必须在构建期全部生成 |
| RSS 和 sitemap 是否正常输出 | 需要确认静态导出后的路径 |
| 图片、字体、搜索索引路径是否正确 | 静态站点路径更敏感 |
| 404 页面是否符合预期 | 静态服务器需要单独配置 |

因此建议第一阶段先使用 `Nginx + next start`，等流程稳定后再考虑纯静态导出。

## 推荐落地顺序

1. 先在云服务器上手动跑通 `npm run build` 和 `npm run start`。
2. 配置 systemd，让服务能开机自启和异常重启。
3. 配置 Nginx 和 HTTPS，让域名可以正常访问。
4. 写 `deploy.sh`，在服务器上手动测试部署脚本。
5. 配置 GitHub Secrets。
6. 添加 GitHub Actions workflow，实现 push 后自动部署。
7. 后续再考虑访问统计、Grafana、CDN、纯静态导出。

这条路线的关键思想是：先让网站稳定上线，再逐步补齐自动化和观测能力。这样风险最低，也最容易排查问题。
