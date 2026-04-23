---
category: "服务"
tags: ["nexus", "minio"]
date: "2026-04-21"
---

# minio + nexus

[Deploy AIStor as a Container | AIStor Object Store Documentation](https://docs.min.io/enterprise/aistor-object-store/installation/container/install/)

既然磁盘和代理环境都已就绪，我们直接开始部署。我们将使用 Docker 容器化部署 MinIO（作为 S3 存储）和 Nexus，并完成两者的对接。

> [!warning]+ minio容器版本
> ref: https://github.com/minio/minio/discussions/21316
>
> minio 从某个版本后，在 webUI 上移出了管理功能，只能通过命令行进行管理；
>
> 要么回退到之前的版本，这里选择帖子里的这个版本 `RELEASE.2025-04-22T22-12-26Z`
> 要么安装一个第三方的 webUI

### 第一步：创建宿主机目录并设置权限

由于容器内的进程（尤其是 Nexus）通常以特定非 root 用户运行，我们需要提前创建目录并开放权限。

```shell
sudo mkdir -p /data/minio/data /data/minio/config
sudo mkdir -p /data/nexus/data
```

```shell
docker top minio -eo user,pid,comm
```

```plain
USER                PID                 COMMAND
root                2349                minio
```

```shell
docker top nexus -eo user,pid,comm
```

```plain
USER                PID                 COMMAND
200                 2476                java
```

```shell
# 重点：Nexus 容器内部用户 UID 是 200，必须授权，否则启动会报错 Permission denied
sudo chown -R 200:200 /data/nexus/data
sudo chown -R root:root /data/minio/
sudo chmod -R 755 /data/minio/
```

### 第二步：编写 Docker Compose 文件

使用 `docker-compose` 是最推荐的管理方式。在当前目录创建 `docker-compose.yml`：

```yml
networks:
  nexus-net:
    name: nexus-net
    driver: bridge

services:
  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    container_name: minio
    ports:
      - "9000:9000" # API 端口
      - "9001:9001" # 控制台端口
    volumes:
      - /data/minio/data:/data
      - /data/minio/config:/root/.minio
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: password123 # 请修改为更复杂的密码
    command: server /data --console-address ":9001"
    networks:
      - nexus-net
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s # 每10秒检查一次
      timeout: 5s # 5秒超时
      retries: 5 # 重试5次失败后认为不健康
      start_period: 10s # 容器启动后10秒内不计入失败

  nexus:
    image: sonatype/nexus3
    container_name: nexus
    ports:
      - "8081:8081"
    volumes:
      - /data/nexus/data:/nexus-data
    networks:
      - nexus-net
    restart: always
    depends_on:
      minio:
        condition: service_healthy
```

- `RELEASE.2025-04-22T22-12-26Z` [minio admin features gone · minio/minio · Discussion #21316](https://github.com/minio/minio/discussions/21316)

**启动命令：**

```
docker-compose up -d
```

---

### 第三步：配置 MinIO 准备 S3 存储桶

1. 访问 `http://<虚拟机IP>:9001`（账号 `admin` / 密码 `password123`）。
2. 进入 **Buckets** -> **Create Bucket**，创建一个名为 `iso-bucket` 的桶。
3. 进入 **Access Keys** -> **Create Access Key**，记下生成的 `Access Key` 和 `Secret Key`（对接 Nexus 时需要）。

---

### 第四步：配置 Nexus 使用 S3

1. 访问 `http://<虚拟机IP>:8081`。
2. **初始密码**：运行 `docker exec nexus cat /nexus-data/admin.password` 获取。

3. 初始访问修改密码为 `admin`，默认允许匿名访问
4. 进入顶部齿轮图标 (**Repository**) -> **Blob Stores** -> **Create blob store**。
5. **Type** 选择 `S3`。
6. **配置参数：**
   - **Name**: `iso-blob-store`
   - **Region**: `us-east-1` (MinIO 默认随便填一个即可)
   - **Bucket**: `iso-bucket`
   - **Access Key ID / Secret Access Key**: 填写刚才在 MinIO 创建的 Key。
   - **Endpoint URL**: `http://minio:9000` (容器间访问直接用服务名)
   - **Signature Version**: `S3V4`
   - 勾选 **Use Path Style Access**（MinIO 必须勾选此项）。

7. 点击 **Save**，如果配置正确，Nexus 会成功连接并在 MinIO 桶里创建一些元数据。

---

### 第五步：创建 Raw 仓库存储 ISO

1. 进入 **Repository** -> **Repositories** -> **Create repository**。
2. 选择 **raw (hosted)** 类型。
3. **配置参数：**
   - **Name**: `iso-repo`
   - **Blob store**: 选择刚才创建的 `s3-blob-store`。
   - **Deployment policy**: 根据需求选择 `Allow redeploy`（允许覆盖）。

4. 点击 **Create repository**。

---

### 第六步：如何上传测试

你可以使用 `curl` 或是直接在界面上传。

**使用 curl 上传一个 ISO 文件测试：**

```
curl -u admin:admin --upload-file ./ubuntu-22.04.iso http://10.15.17.3:8081/repository/iso-repo/ubuntu-22.04.iso
```

- 初始访问 nuxus 时已经重置密码为 admin

```shell
docker logs -f nexus
docker logs -f minio
```

### 总结

现在你的架构是：

- **物理层**：新挂载的 `/data` 磁盘。
- **存储层**：MinIO 容器（数据落地在 `/data/minio`）。
- **应用层**：Nexus 容器，其文件存储（Blob Store）实际指向了 MinIO 提供的 S3 接口。

**后续如果你那 14TB 的数据也是 ISO 类型，可以利用 Nexus 的 API 批量上传，这样所有文件都会通过 Nexus 路由到 S3 存储中。需要我帮你写一个 Python 的批量上传脚本吗？**

## nexus 软删除

这是一个非常经典的 **Nexus + S3/MinIO 对象存储** 的行为机制问题。

简单来说：**Nexus 的“删除”操作默认只是“逻辑删除”（打标签），并不会立即从底层的 MinIO 中物理删除文件。**

以下是导致这个现象的三个主要原因以及解决方法：

### 1. Nexus 的“软删除”机制 (Soft Delete)

当你点击 Nexus 界面上的 Delete 时，Nexus 只是在自己的数据库里把这个组件标记为“已删除”，这样是为了防止误删。此时，底层 MinIO 里的 2G ISO 文件依然原封不动。

### 2. 必须运行“清理任务” (Cleanup Task)

要真正释放空间，你需要在 Nexus 后台手动运行或配置定时任务。

**解决步骤：**

1. 登录 Nexus 后台 (Admin -> System -> Tasks)。
2. 点击 **Create Task**。
3. 选择 **Admin - Compact blob store**（针对 S3/MinIO 类型的 Blob Store，这个任务负责清理标记为删除的数据）。
4. 选择你对应的 Blob Store（比如 `nexus-s3-blob`）。
5. 运行这个 Task。运行完成后，Nexus 才会向 MinIO 发送删除指令。

### 3. MinIO 的“版本控制” (Versioning)

如果你在 MinIO 上开启了 **Versioning（版本控制）**，即使 Nexus 发送了删除指令，MinIO 也只会给文件打上一个“删除标记”（Delete Marker），旧的数据块依然会保留在磁盘上以备恢复。

- **检查方法**：进入 MinIO 控制台 (9001 端口)，查看该 Bucket 的 Versioning 设置。
- **解决方法**：如果开启了版本控制，你需要配置 MinIO 的 **Lifecycle（生命周期管理）**，设置“过期非当前版本”的清理规则。

---

### 4. 为什么 `du` 命令显示还是 4.0G？

因为 Linux 的 `du` 命令直接读取的是磁盘块占用。在 Nexus 真正执行 `Compact blob store` 任务之前，那两个 2G 的 ISO 文件作为对象存储的“数据块”（通常存放在 `content` 目录下，文件名是一串随机 ID），依然占用着物理磁盘空间。

### 总结操作建议：

1. **立即清理**：去 Nexus 后台手动跑一遍 **Admin - Compact blob store** 任务。
2. **自动化**：建议创建一个定时任务（例如每天凌晨 3 点），自动执行该清理操作，否则你的 MinIO 磁盘空间只会增加不会减少。
3. **检查 MinIO**：如果跑完任务 `du` 还是 4.0G，请去 MinIO 控制台彻底删除该 Bucket 下的过期版本。

**你可以先去 Nexus 的 Tasks 界面看一下有没有这个任务在跑？**

# 自动化联动

![[minio-nexus.png]]

答案是**肯定的**。Nexus 的 `raw` 仓库（你现在的 ISO 仓库）不仅能存文件，它还是 PXE 自动化安装和 Packer 镜像构建流程中不可或缺的“资源中心”。

把它们集成起来后，你的基础架构流程会变成这样：

---

### ## 1. 与 PXE 集成 (自动化装机)

[[01 pxe 自动安装 ubuntu]]

在 PXE 环境（如使用 iPXE 或 PXELINUX）中，通常需要通过 HTTP 协议下载内核文件（`vmlinuz`）和初始化磁盘（`initrd.img`）。

- **传统做法**：在每台 PXE 服务器上维护一个 `tftp` 或 `nginx` 目录。
- **Nexus 做法**：
  1. 你只需将 ISO 里的文件解压并上传到 Nexus。
  2. PXE 配置文件（如 `default` 或 `ipxe.cfg`）直接指向 Nexus 的 URL：

     Bash

     ```
     kernel http://192.168.17.134:8081/repository/iso-storage/ubuntu/vmlinuz
     initrd http://192.168.17.134:8081/repository/iso-storage/ubuntu/initrd.img
     append root=/dev/ram0 ip=dhcp url=http://192.168.17.134:8081/repository/iso-storage/ubuntu/autoinstall.yaml
     ```

- **优势**：ISO 统一管理，支持多版本并存，且 Nexus 强大的缓存/带宽能力能支撑大规模服务器同时重装。

---

### ## 2. 与 Packer 集成 (自动化镜像制作)

[[实验 - packer 在 workstation 安装 ubuntu 虚拟机]]

Packer 在构建虚拟机镜像（如 OVA, QCOW2）时，第一步通常是下载官方 ISO。

- **痛点**：Packer 默认从官网下载 ISO，网速慢且不稳定。
- **Nexus 集成**：
  在 Packer 的 HCL 配置文件中，将 `iso_url` 指向你的 Nexus 地址：
  Terraform
  ```
  source "vmware-iso" "ubuntu" {
    iso_url      = "http://192.168.17.134:8081/repository/iso-storage/ubuntu-22.04.5.iso"
    iso_checksum = "sha256:xxxxxx..."
    # Packer 会直接从你的局域网 Nexus 高速拉取 ISO
  }
  ```
- **优势**：**构建加速**。内网传输 ISO 只要几秒钟，大大缩短了镜像打包时间。

---

### ## 3. 进阶：作为自动化安装的 Kickstart/Cloud-init 托管点

自动化安装操作系统时，需要一个配置文件（Ubuntu 叫 `user-data`，CentOS 叫 `ks.cfg`）。

- 你可以将这些配置文件也存放在 Nexus 的 `iso-storage` 仓库中。
- 机器引导时，通过 HTTP 直接读取 Nexus 上的配置，实现**真正的一键无人值守安装**。

---

### ## 4. 为什么现在的方案（Nexus + MinIO）很香？

- **高可用性**：你的 ISO 实际上存在 MinIO 里。如果未来机器变多，你可以给 MinIO 做集群扩容，而不需要改动 Nexus。
- **统一视图**：不管是 Packer 还是 PXE，都只需要访问 Nexus 这个统一的 HTTP 接口，不需要去管底层的 S3 存储细节。

---

### ### 现在的状态检查

你的那个 2.6GB 的 Ubuntu ISO 传上去了吗？

1. **如果还没传完**：先用 `curl.exe -u admin:admin --upload-file ./small_test.txt ...` 确认 100% 成功。
2. **如果已传完**：尝试在浏览器直接打开 ISO 的 URL。如果浏览器弹出了下载窗口，说明你的 **自动化安装基石** 已经打好了。

**下一步需要我帮你写一个简单的 Packer 脚本模板，教你如何对接这个仓库吗？**
