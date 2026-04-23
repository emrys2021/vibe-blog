---
category: "服务/虚拟化/hashicorp"
tags: ["虚拟化", "packer"]
date: "2026-04-21"
---

> [!info]+ 实验目的
> 使用 [[实验 - minio + nexus 搭建 iso repo]] 搭建好 `iso repo` 后，使用 `packer` 拉取 `nexus` 上的 `iso`，然后在 `vmware workstaion` 中创建 `ubuntu vm`

## 编写 packer 配置文件

> [!abstract]+ vmware plugin
> vmware plugin 提供 2个 builder plugin
>
> 1. `vmware-iso`：This builder creates a virtual machine, installs a guest operating system from an ISO, provisions software within the guest operating system, and then exports the virtual machine as an image. Use this builder to start by creating a new image.
> 2. `vmware-vmx`：This builder imports an existing virtual machine, runs provisioners on the virtual machine, and then exports the virtual machine as an image. Use this builder to start from an existing image as the source.

```shell
packer
│───ubuntu-22.04.box
│───ubuntu.auto.pkrvars.hcl
│───ubuntu.pkr.hcl
│───variables.pkr.hcl
├───http
│   ├───meta-data
│   └───user-data
├───packer_cache
└───vagrant
    ├───Vagrantfile
    └───.vagrant
        ├───bundler
        │   └───global.sol
        ├───machines
            └───default
                └───vmware_desktop

```

###### ubuntu.pkr.hcl

_packer/ubuntu.pkr.hcl_

```yaml
packer {
  # 插件声明：Packer 1.7+ 版本必须显式声明插件，否则无法识别 source 或 post-processor
  required_plugins {
	# vmware plugin 提供 vmware-iso builder plugin
    vmware = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/vmware"
    }

	# vagrant plugin 提供 vagrant post-processor
    vagrant = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/vagrant"
    }
  }
}

source "vmware-iso" "ubuntu_server" {
  # 镜像源设置：通过变量动态拼接 Nexus 私服地址，提高在国内环境下的下载速度
  iso_url      = "${var.nexus_url}${var.iso_path}"
  # 使用本地 iso path，windows系统也使用正斜杠
  # iso_url      = "D:\Users\JKL\Downloads\ubuntu-22.04.5-live-server-amd64.iso"
  iso_checksum = var.iso_checksum

  # VMware 硬件配置
  vm_name       = "ubuntu-22.04-packer"
  guest_os_type = "ubuntu-64"
  firmware      = "efi"   # 启用 UEFI 引导模式（现代系统推荐）
  version       = "14"    # 虚拟机硬件兼容性版本（Workstation 14 及以上）
  cpus          = 2
  memory        = 2048
  disk_size     = 40000   # 单位为 MB (约 40GB)
  headless      = false   # 设为 false 以便通过 GUI 实时调试 GRUB 引导过程

  # SSH 安全连接设置：Packer 依靠此配置进入系统执行后续的 shell 脚本
  ssh_username = var.ssh_username
  ssh_password = var.ssh_password
  ssh_timeout  = "20m"    # 预留足够时间等待安装完成并重启
  # 关机指令：使用 sudo -S 配合变量密码，确保安装完成后能平滑关闭虚拟机
  shutdown_command = "echo '${var.ssh_password}' | sudo -S shutdown -P now"

  # 自动安装引导逻辑 (Cloud-init / Subiquity)
  http_directory = "http" # 存放 user-data 和 meta-data 的本地目录
  boot_wait      = "5s"   # 等待进入 GRUB 界面的时间，视机器性能可适当延长
  boot_key_interval = "50ms"

  # GRUB 自动化按键指令
  boot_command = [
    "e", # 按 'e' 编辑当前引导项
    "<down><down><down><end><left><left><left><left>", # 定位到 linux 行并越过尾部的 ' ---'
    # 核心坑点说明：
    # 1. ds=nocloud-net;s=... 这里的单反斜杠会被 Packer 转义，因此必须用 \\;
    #    确保发送到 GRUB 的是 \; 从而让 GRUB 将分号视为普通字符而非命令结束符。
    # 2. {{ .HTTPIP }} 和 {{ .HTTPPort }} 是 Packer 自动生成的本地文件服务器地址。
    " autoinstall ds=nocloud-net\\;s=http://{{ .HTTPIP }}:{{ .HTTPPort }}/<wait2>",
    "<f10>" # 按 F10 正式引导内核
  ]
}

build {
  sources = ["source.vmware-iso.ubuntu_server"]

  # Provisioner：系统安装成功并重启后的初始化操作
  provisioner "shell" {
    inline = [
      # 等待 cloud-init 彻底运行结束，防止 apt 进程被锁死
      "while [ ! -f /var/lib/cloud/instance/boot-finished ]; do sleep 5; done",
      "echo 'VM 构建完成！'",
      "sudo apt-get update"
    ]
  }

  # Post-processor：将生成的虚拟机导出为 Vagrant 专用的 .box 文件
  post-processor "vagrant" {
    keep_input_artifact = true     # 保留 output-vmware-iso 文件夹，方便后续手动检查 VM
    output              = "ubuntu-22.04.box"
    # 注意：此处必须使用 "vmware" 关键字，Packer 才能正确识别并生成对应的 metadata.json
    provider_override   = "vmware"
  }
}
```

- `boot_command`：在 grub 启动菜单界面可以按 `esc` 进入 grub命令行，或者按 `e` 进入编辑模式，来设置启动参数；
  - 多次测试在 grub命令行，配置中写的启动参数总是被吞前几个字符，所以最后改为按 `e` 进入编辑模式
- 根据 [这个帖子](https://shantanoo-desai.github.io/posts/technology/packer-ubuntu-qemu/)，`boot_command` 中的 `ds=nocloud-net;s=http://xxx` 中的必须转义 `ds=nocloud-net;s=http://xxx` 才能正常触发 `cloud-init`

###### variables.pkr.hcl

_packer/variables.pkr.hcl_

```yaml
variable "nexus_url" {
type        = string
description = "Nexus 仓库的基础地址"
}

variable "iso_path" {
type        = string
description = "ISO 在仓库中的相对路径"
}

variable "iso_checksum" {
type        = string
description = "ISO 的 SHA256 校验和"
}

variable "ssh_username" {
type    = string
default = "ubuntu"
}

variable "ssh_password" {
type    = string
default = "ubuntu"
}
```

###### ubuntu.auto.pkrvars.hcl

_packer/ubuntu.auto.pkrvars.hcl_

```yaml
nexus_url    = "http://192.168.17.134:8081"
iso_path     = "/repository/iso-storage/ubuntu-22.04.5-live-server-amd64.iso"
iso_checksum = "sha256:9bc6028870aef3f74f4e16b900008179e78b130e6b0b9a140635434a46aa98b0"

ssh_username = "ubuntu"
ssh_password = "ubuntu"
```

- 将变量定义文件后缀改成 `.auto.pkrvars.hcl` 会自动变量赋值，Packer 会自动加载其中的数据，不需要在 `packer validate` `packer build` 的时候指定变量定义文件

###### user-data

[[01 pxe 自动安装 ubuntu#user-data]]

_packer/http/user-data_

```yaml
#cloud-config
autoinstall:
  version: 1
  # default behavior
  locale: "en_US.UTF-8"
  # default behavior
  keyboard:
    layout: us
    variant: ""
    toggle: null
  timezone: "Asia/Shanghai"

  network:
    version: 2
    ethernets:
      nic0:
        match:
          name: ens33 # 不同发行版可能不同
        set-name: eth0
        dhcp4: true

  identity: # identity key 是唯一必须配的设置，除非配了 user-data key
    hostname: ubuntu-server
    username: ubuntu
    # password: ubuntu
    password: "$6$exDY1mhS4KUYCE/2$zmn9ToZwTKLhCw.b4/b.ZRTIZM30JZ4QrOQ2aOXJ8yk96xpcCof0kxKwuX1kqLG/ygbJ1f8wxED22bTL4F46P0"

  ssh:
    install-server: true # 启用安装 openssh-server
    allow-pw: true # 允许密码登录（如果用密码认证；否则设 false 只用密钥）
    # authorized-keys: []

  # proxy: http://192.168.17.1:10809
  apt:
    # 不保留 ISO 默认的源，完全使用下面定义的源
    preserve_sources_list: false
    disable_suites: [security]
    mirror-selection:
      primary:
        # - country-mirror
        # - uri: "http://archive.ubuntu.com/ubuntu"
        - uri: "http://rdsource.tp-link.com.cn/ubuntu"
        - uri: "http://mirrors.aliyun.com/ubuntu"
        - uri: "https://mirrors.tuna.tsinghua.edu.cn/ubuntu"
    fallback: offline-install
    # geoip: true

    # # 1. 定义主镜像源（以阿里云为例，速度快且稳定）
    # primary:
    #   - arches: [amd64, default]
    #     # 第一优先级：官方源（虽然慢，但最权威）
    #     uri: "http://archive.ubuntu.com/ubuntu"

    #     # 降级路径：如果官方源连接失败（Status 100），自动按顺序尝试以下地址
    #     search:
    #       - "http://mirrors.aliyun.com/ubuntu" # 备选 1：阿里云
    #       - "https://mirrors.tuna.tsinghua.edu.cn/ubuntu" # 备选 2：清华大学

    #     # 定义需要同步的库分支
    #     suites: [jammy, jammy-updates, jammy-security]

    # 2. 自动化强化配置 (对应官方示例中的 conf 块)
    conf: |
      APT {
        Get {
          Assume-Yes "true";      # 所有提示默认选 Yes，防止安装 fish/bat 时卡住
          Fix-Broken "true";      # 自动修复依赖冲突
        }
      }
      # 限制并发连接，防止某些镜像站因为连接数过多拒绝请求
      Acquire::Queue-Mode "access";
  # apt:
  #   preserve_sources_list: false
  #   primary:
  #     - arches: [default]
  #       uri: "http://archive.ubuntu.com/ubuntu"
  #       suites: [jammy, jammy-updates, jammy-security] # 22.04 = jammy；高版本请改成 noble 等
  #       components: [main, restricted, universe, multiverse]
  # sources:
  #   tplink-mirror:
  #     source: "deb http://rdsource.tp-link.com.cn/ubuntu jammy main restricted universe multiverse"
  # disable_suites: [security]

  package_update: false # default: false
  package_upgrade: false # default: false
  updates: security # default behavior. Updates from the security pocket are installed.

  packages:
    - fish
    - bat
    - net-tools

  storage:
    config:
      # === 磁盘（GPT）/ BIOS 引导目标（放在磁盘上）===
      - {
          id: disk-os,
          type: disk,
          match: { size: smallest },
          ptable: gpt,
          preserve: false,
          wipe: superblock-recursive,
          grub_device: true,
        }

      # === ESP 分区 512M，存放 UEFI bootloader（grubx64.efi）===
      - {
          id: part-esp,
          type: partition,
          device: disk-os,
          size: 536870912,
          flag: boot,
          preserve: false,
          wipe: superblock,
          grub_device: true,
        }
      - { id: fmt-esp, type: format, fstype: fat32, volume: part-esp }
      - { id: mnt-esp, type: mount, device: fmt-esp, path: /boot/efi }

      # === Boot 分区 512M，存放内核和初始临时文件系统 ===
      - {
          id: part-boot,
          type: partition,
          device: disk-os,
          size: 536870912,
          preserve: false,
          wipe: superblock,
        }
      - { id: fmt-boot, type: format, fstype: ext4, volume: part-boot }
      - { id: mnt-boot, type: mount, device: fmt-boot, path: /boot }

      # 4. LVM 物理容器 (占用剩余全部空间)
      - { id: part-lvm, type: partition, device: disk-os, size: -1 }
      - { id: vg01_int, type: lvm_volgroup, devices: [part-lvm], name: vg01 }

      # 5. LVM 逻辑卷: Swap (8G)
      - {
          id: lv-swap,
          type: lvm_partition,
          volgroup: vg01_int,
          name: lv_swap,
          size: 8G,
        }
      - { id: fmt-swap, type: format, fstype: swap, volume: lv-swap }

      # 6. LVM 逻辑卷: Var (10G)
      - {
          id: lv-var,
          type: lvm_partition,
          volgroup: vg01_int,
          name: lv_var,
          size: 10G,
        }
      - { id: fmt-var, type: format, fstype: ext4, volume: lv-var }
      - { id: mnt-var, type: mount, device: fmt-var, path: /var }

      # 7. LVM 逻辑卷: Root (剩余全部)
      - {
          id: lv-root,
          type: lvm_partition,
          volgroup: vg01_int,
          name: lv_root,
          size: -1,
        }
      - { id: fmt-root, type: format, fstype: ext4, volume: lv-root }
      - { id: mnt-root, type: mount, device: fmt-root, path: / }

  user-data:
    users:
      - name: ubuntu # 给 ubuntu 用户 sudo 权限，执行 packer provisioner 中的 sudo 命令
        groups: [sudo]
        sudo: "ALL=(ALL) NOPASSWD:ALL"

      - name: ansible
        gecos: Ansible User
        groups: users,admin,wheel
        sudo: "ALL=(ALL) NOPASSWD:ALL"
        shell: /bin/bash
        lock_passwd: true
        # ssh_authorized_keys:
        # - "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDRCJCQ1UD9QslWDSw5Pwsvba0Wsf1pO4how5BtNaZn0xLZpTq2nqFEJshUkd/zCWF7DWyhmNphQ8c+U+wcmdNVcg2pI1kPxq0VZzBfZ7cDwhjgeLsIvTXvU+HVRtsXh4c5FlUXpRjf/x+a3vqFRvNsRd1DE+5ZqQHbOVbnsStk3PZppaByMg+AZZMx56OUk2pZCgvpCwj6LIixqwuxNKPxmJf45RyOsPUXwCwkq9UD4me5jksTPPkt3oeUWw1ZSSF8F/141moWsGxSnd5NxCbPUWGoRfYcHc865E70nN4WrZkM7RFI/s5mvQtuj8dRL67JUEwvdvEDO0EBz21FV/iOracXd2omlTUSK+wYrWGtiwQwEgr4r5bimxDKy9L8UlaJZ+ONhLTP8ecTHYkaU1C75sLX9ZYd5YtqjiNGsNF+wdW6WrXrQiWeyrGK7ZwbA7lagSxIa7yeqnKDjdkcJvQXCYGLM9AMBKWeJaOpwqZ+dOunMDLd5VZrDCU2lpCSJ1M="

  shutdown: reboot
```

###### meta-data

[[01 pxe 自动安装 ubuntu#meta-data]]
_packer/http/meta-data_

```yaml
instance-id: iid-ubuntu-autoinstall
```

## 开始使用 packer 构建

初始化插件

```powershell
packer init .
```

格式化检查

```powershell
packer fmt .
```

```powershell
packer validate .
```

开始构建

```powershell
packer build .
```

## 自动安装失败如何排查

如果cloud-init没有正常起作用，安装卡住选择语言界面，按 **`Alt + F2`** (在 VMware 中可能需要按 `Ctrl + Alt + F2`) 切换到第二个虚拟终端，然后回车进入命令行。

```shell
cat /proc/cmdline
```

- 检查是否收到了参数

```shell
cloud-init status
```

- 查看 Cloud-init 运行状态

## Vagrant

[Install Vagrant ](https://developer.hashicorp.com/vagrant/install)
[Install Vagrant Vmware Utility](https://developer.hashicorp.com/vagrant/install/vmware)

packer 生成 vmware vm，不是完整流程，在 build block 使用 vagrant post-processor 将 artifact 转成 vagrant box，
后续直接用 vagrant 启动 box，不用反复重装系统，还能把环境预设好。

```powershell
vagrant box add ubuntu2204 .\ubuntu-22.04.box
vagrant box list
```

```powershell
mkdir vagrant
cd vagrant
vagrant init ubuntu2204
```

_Vagrantfile_

```ruby
  config.vm.provider "vmware_desktop" do |v|
    # Display the VirtualBox GUI when booting the machine
    v.gui = true

    # Customize the amount of memory on the VM:
    v.memory = "1024"
    v.cpus = "2"
```

```
vagrant plugin install vagrant-vmware-desktop
vagrant plugin list
```

```powershell
vagrant up --provider vmware_desktop
```

## 文档

> [!note]+ 说明
>
> 1. user-data 中 autoinstall 下的 schema 都是 subiquity 文档中定义的 schema，
> 2. 一些配置，如 apt 等，是和 curtin 合并的，可能最终都会转给 curtin，
> 3. auinstall/user-data 下的 schema 是在 cloud-init 文档中定义的 schema，
> 4. 能尽量在 subiquity 阶段把能配的都配了，就不要等系统启动后由 cloud-init service 来配置
>
> `autoinstall/early-commands` `autoinstall/late-commands` 都是在 subiquity 安装阶段执行的，机器重启之前，还是在安装介质的环境；
> `autoinstall/user-data` 是在机器第一次重启之后，进入目标系统，由 cloud-init service 执行。
>
> 大体是这样，一些细节可能还需再研究研究

subiquity 文档：[Autoinstall configuration reference manual - Ubuntu installation documentation](https://canonical-subiquity.readthedocs-hosted.com/en/latest/reference/autoinstall-reference.html#ai-identity)
curtin 文档：[APT Source — curtin 23.1.1 documentation](https://curtin.readthedocs.io/en/latest/topics/apt_source.html#common-snippets)
curtin apt 示例配置：

- [apt-source.yaml « examples - curtin - [no description]](https://git.launchpad.net/curtin/tree/examples/apt-source.yaml)
- [curtin/examples/apt-source.yaml at master · canonical/curtin](https://github.com/canonical/curtin/blob/master/examples/apt-source.yaml)

cloud-init 文档：[Module reference - cloud-init 25.3 documentation](https://cloudinit.readthedocs.io/en/latest/reference/modules.html#set-hostname)
cloud-init user-data block 示例配置：[All cloud config examples - cloud-init 25.3 documentation](https://docs.cloud-init.io/en/latest/reference/examples.html)

[Network configuration - cloud-init 25.3 documentation](https://cloudinit.readthedocs.io/en/latest/reference/network-config.html)

[Cloud-init and autoinstall interaction - Ubuntu installation documentation](https://canonical-subiquity.readthedocs-hosted.com/en/latest/explanation/cloudinit-autoinstall-interaction.html)

```yaml
#cloud-config
# cloud-init directives may optionally be specified here.
# These directives affect the ephemeral system performing the installation.

autoinstall:
  # autoinstall directives must be specified here, not directly at the
  # top level.  These directives are processed by the Ubuntu Installer,
  # and configure the target system to be installed.

  user-data:
    # cloud-init directives may also be optionally be specified here.
    # These directives also affect the target system to be installed,
    # and are processed on first boot.
```

- `autoinstall:` 字段及其直接下级字段，给 Subiquity 用的，规定了安装程序应该如何配置目标磁盘，这些配置会被转化为真实的硬盘数据
- `autoinstall: user-data:` 块，给 cloud-init 用的，安装程序把这部分内容原封不动地写进硬盘里的 `/var/lib/cloud/seed/nocloud-net/user-data`。系统装完重启，第一次进入系统时，Cloud-init 启动。Cloud-init 读取这个文件，开始执行。

## ISO 构建工具

packer 最后得到是 vmware workstaion 的 vm，或者 vsphere 的 vm，这是合理的，因为最终制品就是 vm 或者模板机，
如果希望最后得到的是一个 `.iso` 文件，方便在物理机或其他环境手动安装，应该使用专门的 ISO 构建工具：

- Cubic (Custom Ubuntu ISO Creator):
  - 原理： 它会解压原始 ISO，让你进入一个虚拟终端（chroot），你可以在里面安装软件、修改内核参数、替换背景。
  - 输出： 完成后它会重新封装并生成一个新的 `.iso`。

- Debos / Mkosi:
  - 原理： 通过 YAML 脚本定义操作系统内容。
  - 输出： 可以直接配置输出格式为 `iso`。

- LinuxKit:
  - 如果你在构建容器化操作系统，它的 `linuxkit build -format iso-bios` 命令可以直接输出 ISO。
