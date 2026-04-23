---
category: "Windows系统部署"
tags: ["choco仓库"]
date: "2026-04-21"
---

## choco 仓库测试

1. 部署nexus

```shell
docker run -d -p 8081:8081 --name nexus sonatype/nexus3
```

- `3.88.0-08` community edition

2. 访问 `http://example.host.com:8081`，开启匿名访问

3. 创建 `Blob Store`（可选但建议），用于专门存放 Windows 软件包，方便后期清理和备份。此处只是测试，没有创建，使用 `default blob store`

4. 创建 `Repository`，选择 _`nuget (hosted)`_ 类型，配置参数：
   - Name: `choco-local`
   - Online: 勾选。
   - Storage: 选择刚才创建的 `default blob store`。
   - Deployment Policy: 建议选 `Allow redeploy`（允许覆盖更新）。

5. 创建 `Repository`，选择 _`nuget (group)`_ 类型，配置参数：
   - Name: `choco-group`
   - Online: 勾选。
   - Member: 添加刚才创建的 `choco-local`
   - 必须把 `nuget (hosted)` 套进 `nuget (group)` 里

6. 配置 API Key
   - 点击页面右上角的个人 `ID（admin）`。
   - 选择 `NuGet API Key`，点击 `Access API Key`。
   - 输入当前登录密码，获取一串秘钥。记录下这串 Key，后面上传 `nupkg` 包时要用。

7. 准备一个测试软件包 (`.nupkg`)，并上传到 `Nexus`，见 [[#把 `7-Zip` 做成 `nupkg` 包]]

8. 客户端测试

```powershell
choco source add -n=MyNexus -s="http://192.168.17.241:8081/repository/choco-group/"
```

- 添加 `group repo` 的 url

```powershell
choco source list
```

- 查看添加的测试源

```powershell
choco install my7zip --source=MyNexus
```

- 安装测试

```powershell
choco source remove -n=MyNexus
```

- 测试完成后删除测试源

7. 查看安装的包

```powershell
choco list
choco locate my7zip
```

8. 卸载测试包

```powershell
choco uninstall my7zip
```

#### 把 `7-Zip` 做成 `nupkg` 包

1. 下载 `7zip` 官方 `exe` 安装包并改名为 `my7zip_setup.exe`

2. 生成模板

```powershell
choco new my7zip
```

```output
Chocolatey v2.1.0
Creating a new package specification at D:\temp\nexus_example\my7zip
Generating template to a file
 at 'D:\temp\nexus_example\my7zip\my7zip.nuspec'
Generating template to a file
 at 'D:\temp\nexus_example\my7zip\tools\chocolateyinstall.ps1'
Generating template to a file
 at 'D:\temp\nexus_example\my7zip\tools\chocolateybeforemodify.ps1'
Generating template to a file
 at 'D:\temp\nexus_example\my7zip\tools\chocolateyuninstall.ps1'
Generating template to a file
 at 'D:\temp\nexus_example\my7zip\tools\LICENSE.txt'
Generating template to a file
 at 'D:\temp\nexus_example\my7zip\tools\VERIFICATION.txt'
Generating template to a file
 at 'D:\temp\nexus_example\my7zip\ReadMe.md'
Generating template to a file
 at 'D:\temp\nexus_example\my7zip\_TODO.txt'
Successfully generated my7zip package specification files
 at 'D:\temp\nexus_example\my7zip'
```

3. 修改 `my7zip/my7zip.nuspec`，只需要改这几行：

```xml
<id>my7zip</id> (包的唯一名称)
<version>1.0.0</version> (版本号)
<description>这是我的内网7zip包</description>
```

4. 修改 `my7zip/tools/chocolateyInstall.ps1`，把文件内容清空，只写这几行：

```powershell
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

$packageArgs = @{
    packageName = 'my7zip'
    fileType    = 'exe'
    file64      = Join-Path $toolsDir 'my7zip_setup.exe'
    silentArgs  = '/S'
}

Install-ChocolateyPackage @packageArgs
```

5. 将下载的7zip安装包重命名成 `my7zip_setup.exe`，放到 `my7zip/tools` 目录下

6. 现在你的 `my7zip/tools` 文件夹里应该有两个文件：`chocolateyInstall.ps1` 和 `my7zip_setup.exe`。

7. 在 `my7zip` 文件夹根目录下执行打包命令：

```powershell
choco pack
```

8. 在 `my7zip` 目录下生成 `my7zip.1.0.0.nupkg`，可用于上传到本地搭建的 `nexus choco` 仓库

```powershell
choco push my7zip.1.0.0.nupkg --source="http://192.168.17.241:8081/repository/choco-local/" --api-key="072f5036-7c1e-3ab4-a406-da301e810d73"
```

- 通过 `http` 发送 `api key` 会告警不安全，此处因为是测试，直接添加 `--force` 强制执行
- 如果开启了匿名访问，可以直接上传，如果没开，还会让输入一个 `repo` 的凭据，可以使用部署 `nexus` 时的默认 `admin` 账号

```output
Chocolatey v2.1.0
Attempting to push my7zip.1.0.0.nupkg to http://192.168.17.241:8081/repository/choco-local/
[NuGet] You are running the 'push' operation with an 'HTTP' source, 'http://192.168.17.241:8081/repository/choco-local/'. Non-HTTPS access will be removed in a future version. Consider migrating to an 'HTTPS' source.
Please provide credentials for: http://192.168.17.241:8081/repository/choco-local/
User name: admin
Password: **********
my7zip.1.0.0.nupkg was pushed successfully to http://192.168.17.241:8081/repository/choco-local/
```

9. 在 `nexus` 上检查 `choco-local` 仓库

![[Pasted image 20260129140246.png]]

## nupkg

**Chocolatey 包（.nupkg）就像是一个“快递盒”，而你要分发的软件（比如 Chrome.exe）就是“快递件”。** 要自制一个包，你确实需要准备那个软件的安装包。通常有两种做法：

### 做法 A：制作“离线包”（推荐，适合内网环境）

这种方式把 `.exe` 直接塞进 `.nupkg`。优点是：客户端安装时**不需要联网**，直接从你的 Nexus 仓库拉下来就能装。

1. **准备素材**：比如你有一个 `Notepad++_Installer.exe`。
2. **创建文件夹**：执行 `choco new my-software`。
3. **搬运文件**：把 `Notepad++_Installer.exe` 复制到 `my-software/tools` 目录下。
4. **修改脚本**：编辑 `tools/chocolateyInstall.ps1`，把里面的逻辑改成：“运行当前目录下的这个 `.exe`，并使用静默安装参数 `/S`”。
5. **打包**：执行 `choco pack`。

### 做法 B：制作“在线包”（适合能上外网的环境）

这种方式不塞入 `.exe`，只塞入一个“下载地址”。

1. **修改脚本**：在 `chocolateyInstall.ps1` 里写上：`url = "https://npp.org/setup.exe"`。
2. **打包**：执行 `choco pack`，得到的 `.nupkg` 非常小（只有几 KB）。
3. **结果**：客户端安装时，Chocolatey 会先从你的 Nexus 下脚本，然后**自动去官网下载** `.exe`。

## boxstarter

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://boxstarter.org/bootstrapper.ps1'))
Get-Boxstarter -Force
```

- `Windows` 默认的 `PowerShell` 执行策略通常是 `Restricted` 或 `RemoteSigned`，`iex` 直接下载的脚本无法执行
- `Set-ExecutionPolicy Bypass -Scope Process -Force` 临时允许当前 `PowerShell` 进程运行脚本
- `New-Object System.Net.WebClient` 创建一个最基础的 HTTP 客户端，下载 `boxstarter` 的 `bootstrapper.ps1` 脚本，并立刻在内存中执行
- `bootstrapper.ps1` 确保 `PowerShell` 本身可用，确保 `NuGet Provider` 可用，安装 `Chocolatey`，安装 `Boxstarter` 的所有 `PowerShell` 模块
- `Get-Boxstarter` 负责在当前 powershell会话 导入 `Boxstarter` 模块，初始化当前会话

`boxstarter_init.ps1`

```powershell
# Boxstarter 常规推荐
$Boxstarter.RebootOk = $true
$Boxstarter.NoPassword = $true
$Boxstarter.AutoLogin = $true

# Chocolatey 基础设置
choco feature enable -n allowGlobalConfirmation

# ===== 明确声明 Nexus source（幂等）=====
if (-not (choco source list | Select-String 'MyNexus')) {
    choco source add `
      -n=MyNexus `
      -s="http://192.168.17.241:8081/repository/choco-group/"
}

# ===== 安装软件（全部最新版） =====
choco install my7zip -source MyNexus
choco install git
choco install vscode
choco install googlechrome

# ===== Windows 功能 =====
Enable-WindowsOptionalFeature -Online -FeatureName NetFx3 -All
Enable-RemoteDesktop

# ===== 环境变量 =====
[Environment]::SetEnvironmentVariable(
    "JAVA_HOME",
    "C:\Program Files\Java\jdk",
    "Machine"
)

# PATH 追加
$oldPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$newPath = "$oldPath;C:\Program Files\Git\bin"
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
[Environment]::SetEnvironmentVariable("DEV_HOME", "C:\Dev", "Machine")

# ===== 可能触发重启 =====
Install-WindowsUpdate -AcceptEula

```

- 假设脚本中间触发了重启，系统重启，自动登录，脚本从中断点继续执行，你不需要写任何重启判断逻辑。

```powershell
Install-BoxstarterPackage -PackageName .\init.ps1
```

### 重启继续执行

在执行过程中，Boxstarter 会：

- 记录：
  - 当前执行到哪一步
  - 当前脚本文件
  - 执行参数
- 存到磁盘（例如 ProgramData 目录）

👉 重启后还能知道“我刚才干到哪了”
📌 普通 PowerShell 脚本默认是 无状态的。

在重启前，Boxstarter 会做一件非常关键的事：

> **告诉 Windows：下次开机后，请自动执行我。**

它常用的方式包括（不同版本略有差异）：

- 注册表 `RunOnce`
- 计划任务（Task Scheduler）
- 自动登录 + 启动脚本

这一步的本质是：

> **把“继续执行脚本”变成一个系统启动事件**

📌 普通 PowerShell 脚本 不会、也不应该去干这件事。

Windows 默认是：

- 重启后停在登录界面
- 没有用户会话
- 没有 PowerShell 可运行

Boxstarter 会（在你允许的前提下）：

- 临时启用自动登录
- 用指定用户登录
- 执行恢复脚本
- 执行完后再还原设置

👉 这一步是 Boxstarter 最大的“魔法感”来源

### boxstarter 和 packer

> [!question]+ boxstarter 和 packer 的区别
>
> - Boxstarter 是「机器创建后做什么」，是 运行时初始化（post-provision）
> - Packer 是「机器创建时长什么样」，是 镜像构建（pre-provision）

| 维度         | Boxstarter            | Packer                |
| ------------ | --------------------- | --------------------- |
| 所在阶段     | VM 创建 **之后**      | VM 创建 **之前**      |
| 作用对象     | 单台正在运行的机器    | 一个可复用的 **镜像** |
| 本质         | PowerShell 自动化脚本 | 镜像构建工具          |
| 是否生成镜像 | ❌                    | ✅                    |
| 是否可重用   | 中（脚本级）          | 高（镜像级）          |
| 运行成本     | 每台 VM 都跑一遍      | 只在构建镜像时跑      |
| 启动速度     | 慢（要现装）          | 快（开机即就绪）      |
| 适合改配置   | 非常适合              | 一般                  |
| 适合装软件   | 适合                  | 非常适合（一次装好）  |
| 支持重启续跑 | ✅（强项）            | 由 provisioner 决定   |

> 1️⃣ 用 Packer 做“厚镜像”（Heavy Image）

- Windows 补丁
- .NET / VC++
- 常用基础软件（7zip / git）
- Chocolatey 本身
- Nexus source 已配置好

👉 一年改几次

---

> 2️⃣ 用 Boxstarter 做“薄初始化”（Thin Init）

- 开发工具（最新版）
- 项目相关环境变量
- 用户级设置
- 是否启用某些功能

👉 每次 VM 创建后跑

你可能会想：

> “那我全写在 Packer 里不就行了？”

现实问题是：

- Packer 重建镜像成本高
- 每改一个小设置就要：
  - 重跑 Packer
  - 发布新镜像
- 对“经常变的东西”不友好

👉 Boxstarter 更灵活

> 为什么“只用 Boxstarter”也有上限？

- 每台 VM 都现装软件
- 启动慢
- 对大规模环境不友好
- 依赖外部网络 / Nexus 可用性

👉 Packer 能把成本前移

## powershell + yaml

1. 定义1个软件清单

_`software-set.yaml`_

```yaml
source: MyNexus

packages:
  - name: my7zip
    version: 1.0.0

  - name: git
    version: latest

  - name: vscode
    params: "--installargs '/silent'"

  - name: googlechrome
```

- 以后只维护这个文件

2. 安装 `powershell-yaml` 模块（一次即可）

```powershell
Install-Module powershell-yaml -Scope AllUsers -Force
```

3. 写一个通用的安装脚本

_`Install-SoftwareSet.ps1`_

```powershell
param (
    [string]$ConfigFile = ".\software-set.yaml"
)

Import-Module powershell-yaml

$config = ConvertFrom-Yaml (Get-Content $ConfigFile -Raw)

$source = $config.source

foreach ($pkg in $config.packages) {

    $name = $pkg.name
    $version = $pkg.version
    $params = $pkg.params

    $cmd = "choco install $name -y --source=$source"

    if ($version -and $version -ne "latest") {
        $cmd += " --version=$version"
    }

    if ($params) {
        $cmd += " $params"
    }

    Write-Host "Installing $name..." -ForegroundColor Cyan
    Write-Host $cmd -ForegroundColor DarkGray

    Invoke-Expression $cmd
}
```

4. 执行安装

```powershell
.\Install-SoftwareSet.ps1 -ConfigFile .\software-set.yaml
```

## 制品库

| 方案              | 简介                                           | 适用场景                              |
| ----------------- | ---------------------------------------------- | ------------------------------------- |
| Sonatype Nexus    | 最流行的制品库，支持 NuGet（Choco 包的格式）。 | 绝大多数互联网公司、开发团队。        |
| JFrog Artifactory | 企业级首选，功能极其强大，支持复杂的权限审计。 | 世界 500 强、银行、保险、军工。       |
| ProGet            | Chocolatey 官方推荐的商业方案，集成度最高。    | 对 Windows 环境有深度定制需求的企业。 |
| Simple Server     | 官方提供的轻量级 NuGet 镜像。                  | 中小型公司或实验室环境。              |
