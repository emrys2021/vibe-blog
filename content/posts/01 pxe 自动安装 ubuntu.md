---
category: "服务/虚拟化/hashicorp"
tags: ["虚拟化", "packer"]
date: "2026-04-21"
---

## 相关术语

- **Debian Installer** (d-i)
  Classic installer that has been used until 18.04, deprecated in 20.04.

- **Ubiquity**
  Graphical [desktop installer](https://wiki.ubuntu.com/Ubiquity). D-i preseed based [auto install](https://wiki.ubuntu.com/UbiquityAutomation) is available. See [manual](http://manpages.ubuntu.com/manpages/jammy/man8/ubiquity.8.html) also. LiveCD can be booted from [nfsroot](https://wiki.ubuntu.com/LiveCDNetboot) [(alternate documentation).](https://help.ubuntu.com/community/Installation/LocalNet#A_variation:_Booting_the_.22Live_CD.22_image) There are a number of [arguments](https://wiki.ubuntu.com/DesktopCDOptions) that you can pass to the installer on the kernel command line.

- **Ubuntu Desktop Installer**
  New desktop installer, that replaces Ubiquity. GitHub repo is [here.](https://github.com/canonical/ubuntu-desktop-installer) Discussion on [Ubuntu Discourse](https://discourse.ubuntu.com/t/new-desktop-installer-preview-build/24765) about the new preview build. [Refreshing the Ubuntu Desktop Installer](https://discourse.ubuntu.com/t/refreshing-the-ubuntu-desktop-installer/20659) thread.

- **Subiquity**
  Server installer frontend. GitHub repo can be [found here.](https://github.com/canonical/subiquity)

- **Casper**
  An initramfs hook to boot live, preinstalled systems from read-only media. [See Casper manpage.](http://manpages.ubuntu.com/manpages/jammy/man7/casper.7.html) Ubiquity desktop and subiquity server install ISO medias relies on it.

- **Curtin**
  [The curt installer](https://curtin.readthedocs.io/en/latest/index.html) is written in Python. Subiquity runs curtin in the background.

- **Cloud-init**
  Final [configuration](https://cloudinit.readthedocs.io/en/latest/) in the running system. Subiquity creates initial user, sets up ssh authorized key in the target system through cloud-init.

> [!question]+ Casper
> Linux 启动后必须有一个 `/`，这个 `/` 就是 root filesystem（根文件系统）。
>
> initrd 被解压到内存后，构成一个临时的根文件系统 initramfs，执行 /init，/init 调用 casper 模块，casper 的任务是找到真正的 root filesystem，
> 在 ubuntu live 环境，真正的 root filesystem 是 filesystem.squashfs（位于 ISO 解压后的 casper/filesystem.squashfs），
> casper 找到 squashfs 后，创建一个临时可写的 tmpfs，只读的squashfs 和可写的 tmpfs 共同构建了一个 overlayfs，然后执行 switch_root 切换到这个 overlayfs root filesystem
>
> 在本文中，内核启动参数设置 boot=casper，casper 使用 http 下载 iso，然后从 iso 内找到 squashfs

| 特性          | 旧版本 (14.04, 16.04, 18.04) | 新版本 (20.04, 22.04, 24.04+)        |
| ------------- | ---------------------------- | ------------------------------------ |
| 安装器名称    | Debian Installer (d-i)       | Subiquity                            |
| 配置文件      | `preseed.cfg`                | `user-data` (Autoinstall)            |
| 内核/引导文件 | `netboot.tar.gz`             | `vmlinuz` + `initrd` (来自 Live ISO) |
| 配置语法      | 键值对 (Key-Value)           | YAML 格式                            |

> [!question]+ autoinstall 和 cloud-config
> [Providing autoinstall configuration - Ubuntu installation documentation](https://canonical-subiquity.readthedocs-hosted.com/en/latest/tutorial/providing-autoinstall.html)
> cloud-config 是 cloud-init 使用的配置，这个配置也可以提供给 subiquity 安装器用来自动化安装，而提供的方式就是顶级元素 autoinstall

## Ref

[Molnár Péter's Professional Blog - Ubuntu 22.04 (Jammy) autoinstall over PXE](https://www.molnar-peter.hu/en/ubuntu-jammy-netinstall-pxe.html)
[Ubuntu 24.04 – Howto Autoinstall Ubuntu Desktop 24.04 through PXE Technology (Basic) – Griffon's IT Library](https://c-nergy.be/blog/?p=20051)
[Ubuntu 22.04 Server Autoinstall ISO | Puget Systems](https://www.pugetsystems.com/labs/hpc/ubuntu-22-04-server-autoinstall-iso/)

---

## 环境准备

|      | vm1                                                                                                          | vm2                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 角色 | pxe server                                                                                                   | pxe client                                                                                                |
| 配置 | ubuntu2204，2张网卡；<br>磁盘设置大点，多版本部署要上传很多iso，改成40G；<br>                                | ubuntu2204，默认内存4G改成8G，默认硬盘20G改成60G<br>固件类型设置uefi；<br>启动进入固件，pxe启动设为第一； |
| 网络 | pxe server 网卡1通过宿主机连接内网物理网络；<br>pxe server 网卡2连接自定义虚拟网络vmnet2，静态ip 192.168.1.1 | pxe client 网卡1连接vmnet2，从vm1动态获取ip；<br>dhcp 下发的 dns server 为物理网络的 dns server           |

> [!failure]+ 开机卡initramfs
> 由于要从 `vm1` 下载 `vmlinuz,initrd,iso` 等文件到内存，内存设置大点，不然 `vm2` 下载完 `vmlinuz,initrd` 后卡在 `initramfs` 界面，虚拟机默认4G改成8G

> [!failure]+ aborting install since no mirror is usable
> 在 `autoinstall` 阶段，`user-data` 中 `apt` 相关配置需要连接 `apt` 镜像源，而 `vm2` 只有一个网卡 `ens33` 连接局域网 `vmnet2`，且网关是 `vm1`，所以配置 `vm1` 转发流量：
>
> ```shell
> echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-ipforward.conf
> sudo sysctl --system
> sysctl net.ipv4.ip_forward
> ```
>
> ```shell
> sudo iptables -t nat -A POSTROUTING -o ens33 -j MASQUERADE
> ```
>
> - `sudo iptables -t nat -A POSTROUTING -o ens33 -j MASQUERADE`：所有从 ens33 发出的包，源ip 都转成 ens33 的 ip
>
> ```shell
> iptables -A FORWARD -i ens34 -o ens33 -j ACCEPT
> iptables -A FORWARD -i ens33 -o ens34 -m state --state ESTABLISHED,RELATED -j ACCEPT
> ```
>
> - 允许数据包从 PXE 网段（`ens34`）流向内网（`ens33`）。放行去程报文。
> - 对于从 ens33 转到 ens34 的报文，只有之前已经从 ens34 往 ens33 建立连接的报文才能通过，对回程报文进行管控。
>
> ```
> sudo apt install iptables-persistent -y
> sudo netfilter-persistent save
> sudo iptables -t filter -L -v -n
> sudo iptables -t nat -L -v -n
> ```
>
> - 使用 `netfilter-persistent` 将配置持久化，使用 iptables 查看持久化后的配置

---

## 1. pxe

Ubuntu22.04:
[How to netboot the server installer on amd64 - Ubuntu Server documentation](https://documentation.ubuntu.com/server/how-to/installation/how-to-netboot-the-server-installer-on-amd64/#configure-dhcp-bootp-and-tftp)

The process for network booting the live server installer is similar for both modes and goes like this:

1. The to-be-installed machine boots, and is directed to network boot.
2. The [DHCP](https://documentation.ubuntu.com/server/reference/glossary/#term-DHCP)/BOOTP server tells the machine its network configuration and where to get the bootloader.
3. The machine’s firmware downloads the bootloader over TFTP and executes it.
4. The bootloader downloads configuration, also over TFTP, telling it where to download the kernel, RAM Disk and kernel command line to use.
5. The RAM Disk looks at the kernel command line to learn how to configure the network and where to download the server ISO from.
6. The RAM Disk downloads the ISO and mounts it as a loop device.
7. From this point on the install follows the same path as if the ISO was on a local block device.

The difference between UEFI and legacy modes is that in UEFI mode the bootloader is an [EFI](https://documentation.ubuntu.com/server/reference/glossary/#term-EFI) executable, signed so that is accepted by Secure Boot, and in legacy mode it is [PXELINUX](https://wiki.syslinux.org/wiki/index.php?title=PXELINUX). Most DHCP/BOOTP servers can be configured to serve the right bootloader to a particular machine.

### 1.1 dhcp server

> [!abstract]+ dhcp server 的作用
>
> 1. 提供基本网络配置：ip，gateway, dns server
> 2. 提供 next server：告知客户端 tftp server 地址，指引其下载 bootloader
> 3. 提供 bootfile name：告知客户端 bootloader 的路径，可以根据条件判断返回 legacy bootloader 还是 uefi bootloader

1. 安装 dhcp server

```shell
apt update
apt install isc-dhcp-server -y
```

2. 检查初始状态：默认没有配置监听服务的接口，服务启动失败

```shell
systemctl status isc-dhcp-server
```

3. 配置监听服务的接口

参考 [[netplan]] 在要监听服务的接口（vm1网卡2）上配置静态 ip。

```shell
nano /etc/default/isc-dhcp-server
```

```config
INTERFACESv4="ens34"
INTERFACESv6=""
```

- 配置 `dhcp server` 只在指定接口上处理 `dhcp request`

4. 配置 pxe 相关配置

```shell
nano /etc/dhcp/dhcpd.conf
```

```conf
# 定义 DHCP Option 93，并给它取个名字叫 client-arch
# 这是解决 "no option named arch" 问题的关键
option client-arch code 93 = unsigned integer 16;

subnet 192.168.1.0 netmask 255.255.255.0 {
    range 192.168.1.100 192.168.1.200;
    option routers 192.168.1.1;
    # 指定 pxe server 能正常访问的 dns server，后续客户端通过 pxe server 转发访问
    option domain-name-servers 10.20.193.2;
    # option domain-name-servers 192.168.17.2;
    next-server 192.168.1.1;

    if option client-arch = 00:07 or option client-arch = 00:09 {
        filename "grub/bootx64.efi";
    }
    elsif option client-arch = 00:06 {
        filename "grub/bootia32.efi";
    }
    else {
        filename "bios/pxelinux.0";
    }
}
```

- `next-server` 指定 `tftp server` 地址
- 通过请求报文中的 `client-arch` 字段判断固件类型是 `legacy` 还是 `uefi`
- `dns server` 如果是虚拟机环境，设置 nat 网络的 dns server，公司环境设置内网 dns server

5. dhcp 配置语法检查

```shell
dhcpd -t -cf /etc/dhcp/dhcpd.conf
```

- `-t`: 检测配置文件语法

6. 启动服务，检查状态

```shell
systemctl start isc-dhcp-server
systemctl enable isc-dhcp-server
systemctl status isc-dhcp-server
```

_dhcp抓包排查_

```shell
sudo tcpdump -i ens37 port 67 or port 68 -n -vv -s0
```

### 1.2 tftp server

1. 安装 tftp server

```shell
apt install tftpd-hpa -y
```

2. 启动 tftp server

```shell
systemctl start tftpd-hpa
systemctl enable tftpd-hpa
systemctl status tftpd-hpa
```

3. 编辑 tftp server 配置

```shell
nano /etc/default/tftpd-hpa
```

```config
# /etc/default/tftpd-hpa
TFTP_USERNAME="tftp"
TFTP_DIRECTORY="/srv/tftp"
TFTP_ADDRESS=":69"
TFTP_OPTIONS="--secure --verbose"
```

4. 创建 bootloader 和 boot image 的目录

```shell
## 存放legacy bootloader
mkdir -p /srv/tftp/bios
## 存放legacy bootloader configuration file
mkdir -p /srv/tftp/bios/pxelinux.cfg
## 存放uefi bootloader和uefi bootloader configuration file
mkdir -p /srv/tftp/grub
## 存放boot image(vmlinuz,initrd)
mkdir -p /srv/tftp/boot/casper/ubuntu/{1604,1804,2004,2204,2404,2504}/server
```

_tftp抓包排查_

```shell
sudo tcpdump -i ens37 udp port 69 -n -vv
```

### dnsmasq (optional)

[Ubuntu 24.04 – Deploy Ubuntu 24.04 Desktop through PXE (BIOS & UEFI) – Griffon's IT Library](https://c-nergy.be/blog/?p=20005)
这个帖子使用 `dnsmasq` 内置的 `dhcp server` 和 `tftp server` 替代了 `isc-dhcp-server` 和 `tftpd-hpa`

```shell
sudo nano /etc/dnsmasq.conf
```

```shell
#Interface information
#--use ip addr to see the name of the interface on your system
interface=eth37,lo
bind-interfaces
domain=ubuntu.local

#--------------------------
#DHCP Settings
#--------------------------
#-- Set dhcp scope
dhcp-range=192.168.1.100,192.168.1.200,255.255.255.0,2h

#-- Set gateway option
dhcp-option=3,192.168.1.1

#-- Set DNS server option
dhcp-option=6,192.168.1.1

#-- dns Forwarder info
server=8.8.8.8

#----------------------#
# Specify TFTP Options #
#----------------------#

#--location of the pxeboot file
dhcp-boot=/bios/pxelinux.0,pxeserver,192.168.1.1

#--enable tftp service
enable-tftp

#-- Root folder for tftp
tftp-root=/tftp

#--Detect architecture and send the correct bootloader file
dhcp-match=set:efi-x86_64,option:client-arch,7
dhcp-boot=tag:efi-x86_64,grub/bootx64.efi
```

```shell
sudo systemctl restart dnsmasq
sudo systemctl status dnsmasq
```

### 1.3 boot image

- `vmlinuz` 和 `initrd` 构成了类似 `windows boot image` 的效果[^1]，加载后用来下载最终的 install image
- `boot imge` 的版本需要和 iso 的版本一致
  - 分别从 ubuntu2004,2204,2404,2504 server 版本的 iso 中提取对应的 boot image，放入 `/srv/tftp/boot/casper/ubuntu/<版本号>/server` 下
  - 分别从 ubuntu2004,2204,2404,2504 desktop 版本的 iso 中提取对应的 boot image，放入 `/srv/tftp/boot/casper/ubuntu/<版本号>/desktop` 下

```shell
mkdir -p /srv/tftp/boot/casper/ubuntu/{1604,1804,2004,2204,2404,2504}/server
mkdir -p /srv/tftp/boot/casper/ubuntu/{1604,1804,2004,2204,2404,2504}/desktop
```

```shell
# --- 准备共享的内核和 Initrd ---
# 1. 将内核和初始内存盘复制到 TFTP 根目录下的一个清晰的子目录中
mkdir /mnt/iso
sudo mount /home/jkl/ubuntu-*-live-server-amd64.iso /mnt/iso
# sudo mount /home/jkl/ubuntu-*-desktop-amd64.iso /mnt/iso
sudo cp /mnt/iso/casper/{vmlinuz,initrd} /srv/tftp/boot/casper/ubuntu/2204/server
# sudo cp /mnt/iso/casper/{vmlinuz,initrd} /srv/tftp/boot/casper/ubuntu/2204/desktop
sudo cp /mnt/iso/boot/grub/fonts/unicode.pf2 /srv/tftp/grub
umount /mnt/iso
```

- 这个目录在 [[#legacy bios bootloader configuration file]] 和 [[#uefi bootloader configuration file]] 中需要指定

#### 多版本目录结构设计

```shell
root@jkl /s/t/grub [1]# tree -L 6 /srv/tftp
/srv/tftp
├── bios
│   ├── ldlinux.c32
│   ├── libutil.c32
│   ├── lpxelinux.0
│   ├── menu.c32
│   ├── pxelinux.0
│   ├── pxelinux.cfg
│   │   └── default
│   ├── undionly.kpxe
│   └── vesamenu.c32
├── boot
│   └── casper
│       └── ubuntu
│           ├── 1604
│           │   ├── desktop
│           │   └── server
│           │       ├── ldlinux.c32 -> ubuntu-installer/amd64/boot-screens/ldlinux.c32
│           │       ├── netboot.tar.gz
│           │       ├── pxelinux.0 -> ubuntu-installer/amd64/pxelinux.0
│           │       ├── pxelinux.cfg -> ubuntu-installer/amd64/pxelinux.cfg
│           │       ├── ubuntu-installer
│           │       └── version.info
│           ├── 1804
│           │   ├── desktop
│           │   └── server
│           │       ├── ldlinux.c32 -> ubuntu-installer/amd64/boot-screens/ldlinux.c32
│           │       ├── netboot.tar.gz
│           │       ├── pxelinux.0 -> ubuntu-installer/amd64/pxelinux.0
│           │       ├── pxelinux.cfg -> ubuntu-installer/amd64/pxelinux.cfg
│           │       ├── ubuntu-installer
│           │       └── version.info
│           ├── 2004
│           │   ├── desktop
│           │   └── server
│           │       ├── initrd
│           │       └── vmlinuz
│           ├── 2204
│           │   ├── desktop
│           │   └── server
│           │       ├── initrd
│           │       └── vmlinuz
│           ├── 2404
│           │   ├── desktop
│           │   └── server
│           │       ├── initrd
│           │       └── vmlinuz
│           └── 2504
│               ├── desktop
│               └── server
│                   ├── initrd
│                   └── vmlinuz
└── grub
    ├── bootx64.efi
    ├── grub.cfg
    ├── grubx64.efi
    ├── ipxe.efi
    ├── mmx64.efi
    └── unicode.pf2
```

### 1.4 bootloader

The `NBP` file may be a lightweight `bootloader` such as `PXELINUX(from Syslinux)`, an `iPXE image`, or act as a Windows WDS(Windows Deployment Services), etc.

#### legacy bios bootloader

```shell
apt install pxelinux -y
apt install syslinux-common -y
```

```shell
dpkg -L pxelinux | grep pxelinux.0
dpkg -L syslinux-common | grep bios
```

```shell
# 从 pxelinux 包中复制 pxelinux.0
sudo cp /usr/lib/PXELINUX/{pxelinux.0,lpxelinux.0} /srv/tftp/bios
# 从 syslinux-common 包中复制所有 .c32 模块
sudo cp /usr/lib/syslinux/modules/bios/{ldlinux.c32,libutil.c32,menu.c32,vesamenu.c32} /srv/tftp/bios
```

##### legacy bios bootloader configuration file

```shell
nano /srv/tftp/bios/pxelinux.cfg/default
```

_`/srv/tftp/bios/pxelinux.cfg/default`_

```config
DEFAULT Ubuntu Desktop 22.04
MENU TITLE ULTIMATE PXE SERVER - By JackyLeo - Ver 1.0
PROMPT 0
TIMEOUT 10

MENU COLOR TABMSG  37;40  #ffffffff #00000000
MENU COLOR TITLE   37;40  #ffffffff #00000000
MENU COLOR SEL      7     #ffffffff #00000000
MENU COLOR UNSEL    37;40 #ffffffff #00000000
MENU COLOR BORDER   37;40 #ffffffff #00000000

LABEL Ubuntu Desktop 22.04
	MENU LABEL Install Ubuntu Server
	KERNEL ../boot/casper/ubuntu/2204/server/vmlinuz/
	INITRD ../boot/casper/ubuntu/2204/server/initrd
	APPEND root=/dev/ram0 ramdisk_size=1500000 ip=dhcp boot=casper url=http://192.168.1.1/ubuntu-22.04.5-live-server-amd64.iso autoinstall ds="nocloud-net;s=http://192.168.1.1/ubuntu/autoinstall/server/" debug ---
```

- 指定 `kernel` 和 `initrd`
- 指定最终安装程序：`ubuntu-22.04.5-live-server-amd64.iso` 置于 `/var/www/html` 目录
- 内核先在内存（RAM）中创建一块固定大小的“虚拟硬盘”，并给它分配一个设备名，如 `/dev/ram0`。(`ramdisk_size` 参数就是用来指定这块硬盘大小的)。然后，内核需要一个“文件系统驱动程序”（比如 `ext2` 驱动）来格式化并挂载这个虚拟硬盘。最后，将 `initrd` 文件（它本身就是一个小型的 `ext2` 文件系统镜像）的内容“倾倒”到这个虚拟硬盘上。
- `initramfs` 利用了内核的一种原生内存文件系统，叫做 `ramfs` (或其更高级的版本 `tmpfs`)。这不是一个虚拟硬盘，而是一个直接在内存中创建的、类似文件夹的结构。`initramfs` 文件本身也不是一个文件系统镜像，而是一个简单的 `cpio` 压缩包 (您可以把它理解成 `.zip` 或 `.tar` 文件)。内核启动时，直接在内存中创建一个 `ramfs` 实例，然后将 `initramfs` 压缩包解压到里面。这个解压后的文件夹，就直接成为了内核的初始根目录。
- 现代Linux内核非常聪明。当它被要求加载一个 `initrd` 文件时，它会先检查文件的格式。如果发现是老的 `ext2` 镜像，它就会启用旧的 `initrd` 机制。如果发现是新的 `cpio` 压缩包，它就会自动切换到现代的 `initramfs` 机制，并且会智能地忽略掉 `root=/dev/ram0` 和 `ramdisk_size` 这类已经过时的参数。
- `quiet`：排错时可以配置 `verbose` 参数

> [!tip]+ 注意
> `pxelinux.0` 是从 `/srv/tftp/bios/` 目录下载的，所以 pxelinux.0 认为这是它的工作目录，因此 `kernel` 和 `initrd` 是相对于这个目录来查找的，所以这里使用 `/srv/tftp/bios/../boot` 指定tftp根目录下的boot目录：
>
> ```shell
> root@jkl:/home/jkl# tree /srv/tftp
> /srv/tftp
> ├── bios
> │   ├── ldlinux.c32
> │   ├── libutil.c32
> │   ├── lpxelinux.0
> │   ├── menu.c32
> │   ├── pxelinux.0
> │   ├── pxelinux.cfg
> │   │   └── default
> │   └── vesamenu.c32
> ├── boot
> │   └── casper
> │       └── ubuntu
> │           └── 2204
> │               └── server
> │                   ├── initrd
> │                   └── vmlinuz
> └── grub
>     ├── bootx64.efi
>     ├── grub.cfg
>     ├── grubx64.efi
>     └── mmx64.efi
> ```

#### uefi bootloader

1. 安装 uefi bootloader

```shell
apt install shim-signed grub-efi-amd64-signed -y
```

2. 将 uefi bootloader 拷贝到 tftp 目录

```shell
cp /usr/lib/shim/shimx64.efi.signed /srv/tftp/grub/bootx64.efi
cp /usr/lib/shim/mmx64.efi /srv/tftp/grub/mmx64.efi
cp /usr/lib/grub/x86_64-efi-signed/grubnetx64.efi.signed /srv/tftp/grub/grubx64.efi
```

- Linux发行版需要一个解决方案来满足UEFI安全引导的要求，同时又要避免与微软就其所有引导加载程序和内核二进制文件进行持续的签名流程。由于微软通常拒绝为像GRUB这样采用通用公共许可证（GPL）的引导加载程序进行签名，因此需要一个中间层 。`shim`正是为解决这一问题而设计的。它是一个小巧、经过严格审计的第一阶段引导加载程序，其本身由微软的密钥签名，从而被所有启用安全引导的UEFI固件所信任。`shim`的主要功能是链式加载另一个应用程序，通常是GRUB引导加载程序，而这个第二阶段的引导加载程序则由`shim`内置的或它所信任的密钥来签名。`shim`的这种设计，为Linux发行版提供了一种无需微软直接签名所有组件，即可参与安全引导生态系统的有效途径。
- `grubx64.efi`是第二阶段的主要引导加载程序，其主要职责包括显示引导菜单、解析引导配置（通常是`/boot/grub/grub.cfg`）并加载操作系统内核（`vmlinuz`）和初始RAM磁盘（`initramfs`）到内存中。

_（下面这种也行）_

```shell
apt-get download shim.signed
dpkg -x shim-signed_1.37~18.04.13+15.7-0ubuntu1_amd64.deb shim

apt-get download grub-efi-amd64-signed
dpkg -x grub-efi-amd64-signed_1.187.3~18.04.1+2.06-2ubuntu14.1_amd64.deb grub
```

```shell
sudo cp /home/jkl/grub/usr/lib/grub/x86_64-efi-signed/grubnetx64.efi.signed  /srv/tftp/grub/grubx64.efi
sudo cp /home/jkl/shim/usr/lib/shim/shimx64.efi.signed  /srv/tftp/grub/bootx64.efi
```

##### uefi bootloader configuration file

1. 配置 uefi bootloader config file

```shell
sudo nano /srv/tftp/grub/grub.cfg
```

```config
if loadfont grub/unicode.pf2 ; then
set gfxmode=auto
insmod efi_gop
insmod efi_uga
insmod gfxterm
terminal_output gfxterm
fi

set menu_color_normal=white/black
set menu_color_highlight=black/light-red
set timeout=10
set default="Ubuntu Server 16.04 Auto"

menuentry "Ubuntu Server 16.04 Auto" {
    linux boot/casper/ubuntu/1604/server/ubuntu-installer/amd64/linux auto=true priority=critical \
      url=http://192.168.1.1/ubuntu/preseed/server/ubuntu-1804.cfg \
      netcfg/choose_interface=auto \
      DEBIAN_FRONTEND=text ---
    initrd boot/casper/ubuntu/1804/server/ubuntu-installer/amd64/initrd.gz
}

menuentry "Ubuntu Server 18.04 Auto" {
    linux boot/casper/ubuntu/1804/server/ubuntu-installer/amd64/linux auto=true priority=critical \
      url=http://192.168.1.1/ubuntu/preseed/server/ubuntu-1804.cfg \
      netcfg/choose_interface=auto \
      DEBIAN_FRONTEND=text ---
    initrd boot/casper/ubuntu/1804/server/ubuntu-installer/amd64/initrd.gz
}

# vm 测试时 ubuntu 20.04 安装完不会将目标系统至于启动项首位，会循环进入 pxe 启动
menuentry "Ubuntu Server 20.04 Auto" {
        linux boot/casper/ubuntu/2004/server/vmlinuz ip=dhcp boot=casper url=http://192.168.1.1/ubuntu/iso/ubuntu-20.04.6-live-server-amd64.iso autoinstall ds="nocloud-net;s=http://192.168.1.1/ubuntu/autoinstall/server/" debug ---
        initrd boot/casper/ubuntu/2004/server/initrd
}

menuentry "Ubuntu Server 22.04 Auto" {
        linux boot/casper/ubuntu/2204/server/vmlinuz ip=dhcp boot=casper url=http://192.168.1.1/ubuntu/iso/ubuntu-22.04.5-live-server-amd64.iso autoinstall ds="nocloud-net;s=http://192.168.1.1/ubuntu/autoinstall/server/" debug ---
        initrd boot/casper/ubuntu/2204/server/initrd
}

menuentry "Ubuntu Server 24.04 Auto" {
        linux boot/casper/ubuntu/2404/server/vmlinuz ip=dhcp boot=casper url=http://192.168.1.1/ubuntu/iso/ubuntu-24.04.4-live-server-amd64.iso autoinstall cloud-config-url=/dev/null ds="nocloud-net;s=http://192.168.1.1/ubuntu/autoinstall/server/" debug ---
        initrd boot/casper/ubuntu/2404/server/initrd
}

menuentry "Ubuntu Server 25.04 Auto" {
        linux boot/casper/ubuntu/2504/server/vmlinuz ip=dhcp boot=casper url=http://192.168.1.1/ubuntu/iso/ubuntu-25.04-live-server-amd64.iso autoinstall cloud-config-url=/dev/null ds="nocloud-net;s=http://192.168.1.1/ubuntu/autoinstall/server/" debug ---
        initrd boot/casper/ubuntu/2504/server/initrd
}
```

- `url` 参数指定使用 _`http协议`_ 从 `http server` 获取安装程序
  - 也可以使用 _`nfsroot`_ 和 _`netboot=nfs`_ 参数，指定使用 `nfs协议` 从 `nfs server` 获取安装程序
- `ubuntu-22.04.5-live-server-amd64.iso` 置于 `/var/www/html` 目录
- `initramfs` 环境中一个名为 `casper` 的Live启动脚从 `url` 参数指定的地址下载 `iso` 来进行完整的系统安装
- Live环境成功启动之后，Ubuntu Server 安装程序本身（`subiquity`）根据 `autoinstall` 参数获取 `user-data` 和 `meta-data` 配置文件，并严格按照里面的“剧本”来执行安装。
- **`ds` 参数必须用引号**：[system installation - PXE Booting Ubuntu 24.04 LTS + Autoinstall - Ask Ubuntu](https://askubuntu.com/questions/1513081/pxe-booting-ubuntu-24-04-lts-autoinstall)

- `loadfont grub/unicode.pf2`: 加载一个字体文件，以便在 GRUB 菜单中显示非ASCII字符，或美化菜单文本。
- `set gfxmode=auto`: 自动选择最佳的图形分辨率。
- `insmod efi_gop`: 加载 UEFI Graphics Output Protocol 模块，用于在 UEFI 系统上显示图形界面。
- `insmod efi_uga`: 加载 UEFI Universal Graphics Adapter 模块，与 `efi_gop` 功能类似，用于兼容一些老式或特殊的 UEFI 系统。
- `insmod gfxterm`: 加载图形终端模块。
- `terminal_output gfxterm`: 将终端输出切换到图形模式，这样 GRUB 菜单就能以图形界面显示。
- `set menu_color_normal`: 设置普通菜单项的前景色和背景色。
- `set menu_color_highlight`: 设置被高亮（选中）菜单项的颜色。
- `set timeout=10`: 设置超时时间，单位是秒。如果用户在10秒内没有选择菜单项，GRUB 会自动引导第一个菜单项。

#### other bootloader

##### memtest bootloader

```shell
wget https://www.memtest86.com/downloads/memtest86-usb.zip
mkdir -p /tmp/memtest
unzip memtest86-usb.zip -d /tmp/memtest
```

```shell
mkdir -p /mnt/memtest
sudo losetup -fP /tmp/memtest/memtest86-usb.img
loopdev=$(sudo losetup -a |grep memtest86-usb.img|cut -d: -f1)
sudo mount ${loopdev}p1 /mnt/memtest
mkdir -p /srv/tftp/memtest
sudo cp /mnt/memtest/EFI/BOOT/BOOTX64.efi /srv/tftp/memtest
```

```shell
sudo umount /mnt/memtest
sudo losetup -d ${loopdev}
```

###### memtest bootloader configuration file

_UEFI_

```shell
nano /srv/tftp/grub/grub.cfg
```

```config
menuentry "Memtest86+ UEFI" {
	chainloader /memtest/BOOTX64.efi
}
```

_Legacy BIOS_

```shell
nano /srv/tftp/bios/pxelinux.cfg/default
```

```config

```

### 1.5 http server

- `boot image` 加载前，`pxe` 和 `bootloader` 使用 `tftp` 协议，`boot image` 加载后，`installer kernel` 使用 `http` 协议
- 搭建 http server，把 iso 作为 install image 提供给客户端，同时作为 cloud-init datasource 提供 autoinstall cloud config

```shell
apt install nginx -y
```

```shell
mkdir -p /var/www/html/ubuntu/iso
sudo mv /home/jkl/ubuntu-*.iso /var/www/html/ubuntu/iso
```

```shell
egrep -v "^.*#|^$" /etc/nginx/sites-enabled/default
```

```shell
systemctl start nginx
systemctl enable nginx
systemctl status nginx
```

### 1.6 autoinstall

[Ubuntu 24.04 – Howto Autoinstall Ubuntu Server 24.04 through PXE Technology (Basic) – Griffon's IT Library](https://c-nergy.be/blog/?p=20076)

```shell
sudo apt-get install cloud-init
```

```shell
mkdir -p /var/www/html/ubuntu/autoinstall/{server,desktop}
```

#### meta-data

```shell
sudo nano /var/www/html/ubuntu/autoinstall/server/meta-data
```

```yaml
instance-id: iid-ubuntu-autoinstall
```

#### user-data for server edition

[Autoinstall configuration reference manual - Ubuntu installation documentation](https://canonical-subiquity.readthedocs-hosted.com/en/latest/reference/autoinstall-reference.html#storage)
[All cloud config examples - cloud-init 25.2 documentation](https://cloudinit.readthedocs.io/en/latest/reference/examples.html)

```shell
nano /var/www/html/ubuntu/autoinstall/server/user-data
```

```shell
cloud-init devel schema --config-file user-data
```

> [!example]+ common server user-data
> `/var/www/html/user-data`，适用于 _ubuntu server 20.04 22.04 24.04 25.04_
>
> ```yaml
> #cloud-config
> autoinstall:
>   version: 1
>   locale: "en_US.UTF-8"
>   keyboard:
>     layout: us
>     variant: ""
>     toggle: null
>   timezone: "Asia/Shanghai"
>   identity:
>     hostname: ubuntu-server
>     username: ubuntu
>     # password: ubuntu
>     password: "$6$exDY1mhS4KUYCE/2$zmn9ToZwTKLhCw.b4/b.ZRTIZM30JZ4QrOQ2aOXJ8yk96xpcCof0kxKwuX1kqLG/ygbJ1f8wxED22bTL4F46P0"
>   ssh:
>     install-server: true
>     allow-pw: false
>     # 写入 /home/ubuntu/.ssh/authorized_keys
>     authorized-keys:
>       - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHkB7H2i8vIsFey0HrI1nZl9kwzkfpoKOS5sBj7gFprb ssh-key
>   # 安装阶段由 subiquity 写入 00-installer-config.yaml
>   # 首次启动 cloud-init 读取 user-data 写入 50-cloud-init.yaml
>   network:
>     version: 2
>     renderer: networkd
>     ethernets:
>       nic0:
>         match:
>           name: en*
>         dhcp4: true
>         nameservers:
>           addresses: [10.20.193.2, 172.31.1.1]
>           #addresses: [192.168.17.2]
>   # 推荐使用 curtin 的 primary 语法，可以使用 security 关键字修改 security pocket 的软件源
>   # 另外 security 关键字的语法和 github 上21年的示例也不太一样[^2]，子字段和 primary 一样都是列表，需要用 `-`
>   apt:
>     preserve_sources_list: false
>     primary:
>       - arches: [default]
>         uri: http://rdsource.tp-link.com.cn/ubuntu/
>         # uri: http://mirrors.aliyun.com/ubuntu/
>     security:
>       - arches: [default]
>         uri: http://rdsource.tp-link.com.cn/ubuntu/
>         # uri: http://mirrors.aliyun.com/ubuntu/
>   # subiquity 引入的 mirror-selection 语法，用 mirror-selection 包裹 primary，但是这种语法没测试出来怎么修改 security pocket 的软件源
>   # 由于没法修改 security pocket 的软件源，官方的 security 源速度又慢，所以这种方法直接禁掉 security
>   # fallback 感觉是 mirror-selection 一起用的
>   #apt:
>   #  preserve_sources_list: false
>   #  disable_suites: [security] # 注释掉最终 source.list 中的 security pocket，并在安装阶段不更新安全包
>   #  mirror-selection:
>   #    primary:
>   #      - uri: http://rdsource.tp-link.com.cn/ubuntu
>   #      #- uri: http://mirrors.aliyun.com/ubuntu
>   #      #- uri: https://mirrors.tuna.tsinghua.edu.cn/ubuntu
>   #  fallback: offline-install
>   package_update: false
>   package_upgrade: false
>   # updates: security
>   shutdown: reboot
>
>   storage:
>     config:
>       # === 磁盘（GPT）/ BIOS 引导目标（放在磁盘上）===
>       - {
>           id: disk-os,
>           type: disk,
>           match: { size: smallest },
>           ptable: gpt,
>           preserve: false,
>           wipe: superblock-recursive,
>           grub_device: true,
>         }
>
>       # === ESP 分区 512M，存放 UEFI bootloader（grubx64.efi）===
>       - {
>           id: part-esp,
>           type: partition,
>           device: disk-os,
>           size: 536870912,
>           flag: boot,
>           preserve: false,
>           wipe: superblock,
>           grub_device: true,
>         }
>       - { id: fmt-esp, type: format, fstype: fat32, volume: part-esp }
>       - { id: mnt-esp, type: mount, device: fmt-esp, path: /boot/efi }
>
>       # === Boot 分区 512M，存放内核和初始临时文件系统 ===
>       - {
>           id: part-boot,
>           type: partition,
>           device: disk-os,
>           size: 536870912,
>           preserve: false,
>           wipe: superblock,
>         }
>       - { id: fmt-boot, type: format, fstype: ext4, volume: part-boot }
>       - { id: mnt-boot, type: mount, device: fmt-boot, path: /boot }
>
>       # 4. LVM 物理容器 (占用剩余全部空间)
>       - { id: part-lvm, type: partition, device: disk-os, size: -1 }
>       - { id: vg01_int, type: lvm_volgroup, devices: [part-lvm], name: vg01 }
>
>       # 5. LVM 逻辑卷: Swap (8G)
>       - {
>           id: lv-swap,
>           type: lvm_partition,
>           volgroup: vg01_int,
>           name: lv_swap,
>           size: 8G,
>         }
>       - { id: fmt-swap, type: format, fstype: swap, volume: lv-swap }
>
>       # 6. LVM 逻辑卷: Var (10G)
>       - {
>           id: lv-var,
>           type: lvm_partition,
>           volgroup: vg01_int,
>           name: lv_var,
>           size: 10G,
>         }
>       - { id: fmt-var, type: format, fstype: ext4, volume: lv-var }
>       - { id: mnt-var, type: mount, device: fmt-var, path: /var }
>
>       # 7. LVM 逻辑卷: Root (剩余全部)
>       - {
>           id: lv-root,
>           type: lvm_partition,
>           volgroup: vg01_int,
>           name: lv_root,
>           size: -1,
>         }
>       - { id: fmt-root, type: format, fstype: ext4, volume: lv-root }
>       - { id: mnt-root, type: mount, device: fmt-root, path: / }
>
>   user-data:
>     users:
>       - name: ansible
>         gecos: Ansible User
>         shell: /bin/bash
>         groups: users,admin,sudo,lxd
>         sudo: "ALL=(ALL) NOPASSWD:ALL"
>         # 写入 /home/ansible/.ssh/authorized_keys
>         ssh_authorized_keys:
>           - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHkB7H2i8vIsFey0HrI1nZl9kwzkfpoKOS5sBj7gFprb ssh-key
>     packages: [python3-pip, git, curl, wget, fish, bat, jq]
>     runcmd:
>       - [ln, -sf, /usr/bin/batcat, /usr/local/bin/bat]
> ```
>
> - `user-data` 作为系统“第一次启动”过程的一部分，对这个全新的、空白的系统进行自动化初始配置，将它从一个通用模板变成一个符合您特定需求的、立即可用的服务器。
> - `layout`: 用于**自动**分区，省事但缺乏灵活性；`config`: 用于**手动**分区，灵活且功能强大。
> - 缩进不能用制表符，只能用空格

> [!question]+ run_unattended_upgrades
> https://askubuntu.com/questions/1410553/how-to-disable-unattended-upgrades-during-autoinstall-user-data-cloud-config

> [!question]+ swap分区
> https://askubuntu.com/questions/1545592/autoinstall-failing-at-storage-configuration-on-ubuntu-server-22-04-lts#:~:text=For%20the%20swap%20partition%2C%20you,flag%3A%20swap
>
> 使用 `free -h` 和 `swapon --show` 命令查看

> [!note]+ 生成 ssh 密钥对
> 在管理主机上生成 ssh密钥对，公钥通过 autoinstall 分发
>
> ```shell
> ssh-keygen -t ed25519 -C "ssh-key" -f ~/.ssh/id_ed25519_ssh
> cat ~/.ssh/id_ed25519_ssh.pub
> ```
>
> 分发到 pxe client 后，查看 ansible ssh 公钥：
>
> ```shell
> cat /home/ansible/.ssh/authorized_keys
> ```
>
> 在管理主机上使用私钥登录测试：
>
> ```shell
> ssh -i ~/.ssh/id_ed25519_ssh ansible@<target-ip>
> ```

> [!quote]+ Using Ubuntu Live-Server to automate Desktop installation
> https://github.com/canonical/autoinstall-desktop/blob/main/README.md

#### user-data for desktop edition

> [!tip]+ autoinstall 支持情况
> [Introduction to autoinstall - Ubuntu installation documentation](https://canonical-subiquity.readthedocs-hosted.com/en/latest/intro-to-autoinstall.html)
>
> This format is supported in the following installers:
>
> - Ubuntu Server, version 20.04 and later
> - Ubuntu Desktop, version 23.04 and later

|       | server iso +<br>server user-data | desktop iso +<br>desktop user-data | server iso +<br>desktop user-data                                                                   |
| ----- | -------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| 备注  |                                  |                                    | server user-data 基础上安装 ubuntu-desktop-minimal，配置 NetworkManager<br>很吃网络环境，很容易挂掉 |
| 20.04 | ✅                               |                                    | ✅                                                                                                  |
| 22.04 | ✅                               |                                    | ✅                                                                                                  |
| 24.04 | ✅                               | ✅                                 | ✅                                                                                                  |
| 25.04 | ✅                               |                                    | ❌                                                                                                  |

###### 24.04 desktop iso + desktop user-data

> [!example]+ ubuntu 24.04 desktop user-data
> 如上，ubuntu desktop 版本只在 23.04 及之后才支持 autoinstall。
> 在 vm 上测试 ubuntu desktop 24.04 时，desktop 24.04 的 boot image，安装 install image 时，如果使用 server 24.04 的 user-data，会在安装 ssh server 时报错，
> 给 desktop 24.04 单独准备一个 user-data，ssh server 改到 autoinstall.user-data.packages 下安装，allow-pw、ssh密钥等仍然使用 autoinstall.ssh 进行配置，
>
> ```yaml
> #cloud-config
> autoinstall:
>   version: 1
>   locale: "en_US.UTF-8"
>   keyboard:
>     layout: us
>     variant: ""
>     toggle: null
>   timezone: "Asia/Shanghai"
>   identity:
>     hostname: ubuntu-server
>     username: ubuntu
>     # password: ubuntu
>     password: "$6$exDY1mhS4KUYCE/2$zmn9ToZwTKLhCw.b4/b.ZRTIZM30JZ4QrOQ2aOXJ8yk96xpcCof0kxKwuX1kqLG/ygbJ1f8wxED22bTL4F46P0"
>   ssh:
>     install-server: false
>     allow-pw: false
>     # 写入 /home/ubuntu/.ssh/authorized_keys
>     authorized-keys:
>       - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHkB7H2i8vIsFey0HrI1nZl9kwzkfpoKOS5sBj7gFprb ssh-key
>   # 安装阶段由 subiquity 写入 00-installer-config.yaml
>   # 首次启动 cloud-init 读取 user-data 写入 50-cloud-init.yaml
>   network:
>     version: 2
>     ethernets:
>       nic0:
>         match:
>           name: en*
>         dhcp4: true
>         nameservers:
>           #addresses: [10.20.193.2, 172.31.1.1]
>           addresses: [192.168.17.2]
>   # 推荐使用 curtin 的 primary 语法，可以使用 security 关键字修改 security pocket 的软件源
>   # 另外 security 关键字的语法和 github 上21年的示例也不太一样[^2]，子字段和 primary 一样都是列表，需要用 `-`
>   apt:
>     preserve_sources_list: false
>     primary:
>       - arches: [default]
>         #uri: http://rdsource.tp-link.com.cn/ubuntu/
>         uri: http://mirrors.aliyun.com/ubuntu/
>     security:
>       - arches: [default]
>         #uri: http://rdsource.tp-link.com.cn/ubuntu/
>         uri: http://mirrors.aliyun.com/ubuntu/
>   # subiquity 引入的 mirror-selection 语法，用 mirror-selection 包裹 primary，但是这种语法没测试出来怎么修改 security pocket 的软件源
>   # 由于没法修改 security pocket 的软件源，官方的 security 源速度又慢，所以这种方法直接禁掉 security
>   # fallback 感觉是 mirror-selection 一起用的
>   #apt:
>   #  preserve_sources_list: false
>   #  disable_suites: [security] # 注释掉最终 source.list 中的 security pocket，并在安装阶段不更新安全包
>   #  mirror-selection:
>   #    primary:
>   #      - uri: http://rdsource.tp-link.com.cn/ubuntu
>   #      #- uri: http://mirrors.aliyun.com/ubuntu
>   #      #- uri: https://mirrors.tuna.tsinghua.edu.cn/ubuntu
>   #  fallback: offline-install
>   package_update: false
>   package_upgrade: false
>   # updates: security
>   shutdown: reboot
>
>   storage:
>     config:
>       # === 磁盘（GPT）/ BIOS 引导目标（放在磁盘上）===
>       - {
>           id: disk-os,
>           type: disk,
>           match: { size: smallest },
>           ptable: gpt,
>           preserve: false,
>           wipe: superblock-recursive,
>           grub_device: true,
>         }
>
>       # === ESP 分区 512M，存放 UEFI bootloader（grubx64.efi）===
>       - {
>           id: part-esp,
>           type: partition,
>           device: disk-os,
>           size: 536870912,
>           flag: boot,
>           preserve: false,
>           wipe: superblock,
>           grub_device: true,
>         }
>       - { id: fmt-esp, type: format, fstype: fat32, volume: part-esp }
>       - { id: mnt-esp, type: mount, device: fmt-esp, path: /boot/efi }
>
>       # === Boot 分区 512M，存放内核和初始临时文件系统 ===
>       - {
>           id: part-boot,
>           type: partition,
>           device: disk-os,
>           size: 536870912,
>           preserve: false,
>           wipe: superblock,
>         }
>       - { id: fmt-boot, type: format, fstype: ext4, volume: part-boot }
>       - { id: mnt-boot, type: mount, device: fmt-boot, path: /boot }
>
>       # 4. LVM 物理容器 (占用剩余全部空间)
>       - { id: part-lvm, type: partition, device: disk-os, size: -1 }
>       - { id: vg01_int, type: lvm_volgroup, devices: [part-lvm], name: vg01 }
>
>       # 5. LVM 逻辑卷: Swap (8G)
>       - {
>           id: lv-swap,
>           type: lvm_partition,
>           volgroup: vg01_int,
>           name: lv_swap,
>           size: 8G,
>         }
>       - { id: fmt-swap, type: format, fstype: swap, volume: lv-swap }
>
>       # 6. LVM 逻辑卷: Var (10G)
>       - {
>           id: lv-var,
>           type: lvm_partition,
>           volgroup: vg01_int,
>           name: lv_var,
>           size: 10G,
>         }
>       - { id: fmt-var, type: format, fstype: ext4, volume: lv-var }
>       - { id: mnt-var, type: mount, device: fmt-var, path: /var }
>
>       # 7. LVM 逻辑卷: Root (剩余全部)
>       - {
>           id: lv-root,
>           type: lvm_partition,
>           volgroup: vg01_int,
>           name: lv_root,
>           size: -1,
>         }
>       - { id: fmt-root, type: format, fstype: ext4, volume: lv-root }
>       - { id: mnt-root, type: mount, device: fmt-root, path: / }
>
>   user-data:
>     users:
>       - name: ansible
>         gecos: Ansible User
>         shell: /bin/bash
>         groups: users,admin,sudo,lxd
>         sudo: "ALL=(ALL) NOPASSWD:ALL"
>         # 写入 /home/ansible/.ssh/authorized_keys
>         ssh_authorized_keys:
>           - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHkB7H2i8vIsFey0HrI1nZl9kwzkfpoKOS5sBj7gFprb ssh-key
>     packages: [openssh-server, python3-pip, git, curl, wget, fish, bat, jq]
>     runcmd:
>       - [ln, -sf, /usr/bin/batcat, /usr/local/bin/bat]
> ```

###### 22.04 server iso + desktop user-data

> [!example]+ ubuntu 22.04 desktop user-data
> [autoinstall-desktop](https://github.com/canonical/autoinstall-desktop/blob/main/README.md)
>
> 如上，ubuntu desktop 22.04 不支持 autoinstall，
>
> 1. 参考链接示例，使用 server 版本 user-data，先安装 ubuntu server 22.04，再安装 ubuntu-desktop GUI
> 2. 另外 cloud-init 会在启动时写入 `50-cloud-init.yaml` 的 netplan 配置文件，所以写入一个 99-\*.yaml 的 netplan 配置文件，将 netplan renderer 修改为 NetworkManager
>
> 注意：测试的时候有遇到同样的配置有时能成功安装 ubuntu-desktop，有时不能安装，感觉和网络也有一定关系，比如开着代理连接阿里云apt源，可能触发 subiquity 的某种超时机制之类的
>
> ```yaml
> #cloud-config
> autoinstall:
>   version: 1
>   locale: "en_US.UTF-8"
>   keyboard:
>     layout: us
>     variant: ""
>     toggle: null
>   timezone: "Asia/Shanghai"
>   identity:
>     hostname: ubuntu-server
>     username: ubuntu
>     # password: ubuntu
>     password: "$6$exDY1mhS4KUYCE/2$zmn9ToZwTKLhCw.b4/b.ZRTIZM30JZ4QrOQ2aOXJ8yk96xpcCof0kxKwuX1kqLG/ygbJ1f8wxED22bTL4F46P0"
>   ssh:
>     install-server: true
>     allow-pw: false
>     # 写入 /home/ubuntu/.ssh/authorized_keys
>     authorized-keys:
>       - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHkB7H2i8vIsFey0HrI1nZl9kwzkfpoKOS5sBj7gFprb ssh-key
>   # 安装阶段由 subiquity 写入 00-installer-config.yaml
>   # 首次启动 cloud-init 读取 user-data 写入 50-cloud-init.yaml
>   network:
>     version: 2
>     renderer: networkd
>     ethernets:
>       nic0:
>         match:
>           name: en*
>         dhcp4: true
>         nameservers:
>           #addresses: [10.20.193.2, 172.31.1.1]
>           addresses: [192.168.17.2]
>   # 推荐使用 curtin 的 primary 语法，可以使用 security 关键字修改 security pocket 的软件源
>   # 另外 security 关键字的语法和 github 上21年的示例也不太一样[^2]，子字段和 primary 一样都是列表，需要用 `-`
>   apt:
>     preserve_sources_list: false
>     primary:
>       - arches: [default]
>         #uri: http://rdsource.tp-link.com.cn/ubuntu/
>         uri: http://mirrors.aliyun.com/ubuntu/
>     security:
>       - arches: [default]
>         #uri: http://rdsource.tp-link.com.cn/ubuntu/
>         uri: http://mirrors.aliyun.com/ubuntu/
>   # subiquity 引入的 mirror-selection 语法，用 mirror-selection 包裹 primary，但是这种语法没测试出来怎么修改 security pocket 的软件源
>   # 由于没法修改 security pocket 的软件源，官方的 security 源速度又慢，所以这种方法直接禁掉 security
>   # fallback 感觉是 mirror-selection 一起用的
>   #apt:
>   #  preserve_sources_list: false
>   #  disable_suites: [security] # 注释掉最终 source.list 中的 security pocket，并在安装阶段不更新安全包
>   #  mirror-selection:
>   #    primary:
>   #      - uri: http://rdsource.tp-link.com.cn/ubuntu
>   #      #- uri: http://mirrors.aliyun.com/ubuntu
>   #      #- uri: https://mirrors.tuna.tsinghua.edu.cn/ubuntu
>   #  fallback: offline-install
>   package_update: false
>   package_upgrade: false
>   # updates: security
>   packages:
>     - ubuntu-desktop-minimal
>   late-commands:
>     # Enable the boot splash
>     - curtin in-target -- sed -i /etc/default/grub -e 's/GRUB_CMDLINE_LINUX_DEFAULT=".*/GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"/'
>     - curtin in-target -- update-grub # 在 Ubuntu 里 update-grub 等价于 grub-mkconfig -o /boot/grub/grub.cfg
>     # 禁止 cloud-init 生成 50-cloud-init.yaml（可选，不配也没关系，下方写入的 NM 配置文件优先级更高）
>     - |
>       cat > /target/etc/cloud/cloud.cfg.d/99-disable-network-config.cfg <<'EOF'
>       network: {config: disabled}
>       EOF
>     # 使用 NetworkManager renderer，netplan 配置文件必须在 autoinstall.late-commands 中写入目标系统，这样可以重启一次进行生效（相对于 autoinstall.user-data.write_files）
>     - |
>       cat > /target/etc/netplan/99-network-manager-all.yaml <<'EOF'
>       network:
>         version: 2
>         renderer: NetworkManager
>         ethernets:
>           ens33:
>             dhcp4: true
>       EOF
>     - curtin in-target -- chmod 600 /etc/netplan/99-network-manager-all.yaml
>     # 禁用 networkd 相关服务，安装阶段不能使用 --now，--now 会和 D-bus 总线通信，只能使用 disable 和 mask
>     - curtin in-target -- systemctl disable systemd-networkd.service
>     - curtin in-target -- systemctl disable systemd-networkd-wait-online.service
>   shutdown: reboot
>
>   storage:
>     config:
>       # === 磁盘（GPT）/ BIOS 引导目标（放在磁盘上）===
>       - {
>           id: disk-os,
>           type: disk,
>           match: { size: smallest },
>           ptable: gpt,
>           preserve: false,
>           wipe: superblock-recursive,
>           grub_device: true,
>         }
>
>       # === ESP 分区 512M，存放 UEFI bootloader（grubx64.efi）===
>       - {
>           id: part-esp,
>           type: partition,
>           device: disk-os,
>           size: 536870912,
>           flag: boot,
>           preserve: false,
>           wipe: superblock,
>           grub_device: true,
>         }
>       - { id: fmt-esp, type: format, fstype: fat32, volume: part-esp }
>       - { id: mnt-esp, type: mount, device: fmt-esp, path: /boot/efi }
>
>       # === Boot 分区 512M，存放内核和初始临时文件系统 ===
>       - {
>           id: part-boot,
>           type: partition,
>           device: disk-os,
>           size: 536870912,
>           preserve: false,
>           wipe: superblock,
>         }
>       - { id: fmt-boot, type: format, fstype: ext4, volume: part-boot }
>       - { id: mnt-boot, type: mount, device: fmt-boot, path: /boot }
>
>       # 4. LVM 物理容器 (占用剩余全部空间)
>       - { id: part-lvm, type: partition, device: disk-os, size: -1 }
>       - { id: vg01_int, type: lvm_volgroup, devices: [part-lvm], name: vg01 }
>
>       # 5. LVM 逻辑卷: Swap (8G)
>       - {
>           id: lv-swap,
>           type: lvm_partition,
>           volgroup: vg01_int,
>           name: lv_swap,
>           size: 8G,
>         }
>       - { id: fmt-swap, type: format, fstype: swap, volume: lv-swap }
>
>       # 6. LVM 逻辑卷: Var (10G)
>       - {
>           id: lv-var,
>           type: lvm_partition,
>           volgroup: vg01_int,
>           name: lv_var,
>           size: 10G,
>         }
>       - { id: fmt-var, type: format, fstype: ext4, volume: lv-var }
>       - { id: mnt-var, type: mount, device: fmt-var, path: /var }
>
>       # 7. LVM 逻辑卷: Root (剩余全部)
>       - {
>           id: lv-root,
>           type: lvm_partition,
>           volgroup: vg01_int,
>           name: lv_root,
>           size: -1,
>         }
>       - { id: fmt-root, type: format, fstype: ext4, volume: lv-root }
>       - { id: mnt-root, type: mount, device: fmt-root, path: / }
>
>   user-data:
>     users:
>       - name: ansible
>         gecos: Ansible User
>         shell: /bin/bash
>         groups: users,admin,sudo,lxd
>         sudo: "ALL=(ALL) NOPASSWD:ALL"
>         # 写入 /home/ansible/.ssh/authorized_keys
>         ssh_authorized_keys:
>           - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHkB7H2i8vIsFey0HrI1nZl9kwzkfpoKOS5sBj7gFprb ssh-key
>     packages: [python3-pip, git, curl, wget, fish, bat, jq]
>     runcmd:
>       - [ln, -sf, /usr/bin/batcat, /usr/local/bin/bat]
> ```

#### cloud-init troubleshooting

[Chapter 4. Configuring cloud-init | Configuring and managing cloud-init for RHEL 8 | Red Hat Enterprise Linux | 8 | Red Hat Documentation](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/configuring_and_managing_cloud-init_for_rhel_8/configuring-cloud-init_cloud-content#troubleshooting-cloud-init_configuring-cloud-init)

_实际执行的 `user-data` 配置_

```shell
less /var/log/installer/autoinstall-user-data
```

_`curtin` 日志_

```shell
less /var/log/installer/curtin-install.log
```

_`subiquity` 安装器后台服务日志_

```shell
less /var/log/installer/subiquity-server-debug.log
```

_`cloud-init` 服务日志_

```shell
less /var/log/cloud-init.log
less /var/log/cloud-init-output.log
cloud-init status
```

### 18.04

###### boot image

搜索 18.04 netboot 镜像获取下载链接

```shell
cd /srv/tftp/boot/casper/ubuntu/1804/server
wget http://archive.ubuntu.com/ubuntu/dists/bionic-updates/main/installer-amd64/current/images/netboot/netboot.tar.gz
tar -xzf netboot.tar.gz -C /srv/tftp/boot/casper/ubuntu/1804/server
```

###### preseed

```shell
mkdir -p /var/www/html/ubuntu/preseed/server
nano /var/www/html/ubuntu/preseed/server/ubuntu-1804.cfg
```

```config
### ===== 基础无人值守 =====
# 自动模式，只显示关键问题
d-i auto-install/enable boolean true
d-i debconf/priority select critical

### ===== 语言/键盘/时区 =====
d-i debian-installer/locale string en_US.UTF-8
d-i keyboard-configuration/xkb-keymap select us
d-i time/zone string Asia/Shanghai
d-i clock-setup/utc boolean true
d-i clock-setup/ntp boolean true

### ===== 网络 =====
d-i netcfg/choose_interface select auto
d-i netcfg/get_hostname string ubuntu1804
d-i netcfg/get_domain string local

### ===== 镜像源 =====
d-i mirror/country string manual
d-i mirror/http/hostname string mirrors.aliyun.com
d-i mirror/http/directory string /ubuntu
d-i mirror/http/proxy string

### ===== 用户 =====
d-i passwd/root-login boolean false
d-i passwd/user-fullname string Ubuntu User
d-i passwd/username string ubuntu
d-i passwd/user-password-crypted password $6$exDY1mhS4KUYCE/2$zmn9ToZwTKLhCw.b4/b.ZRTIZM30JZ4QrOQ2aOXJ8yk96xpcCof0kxKwuX1kqLG/ygbJ1f8wxED22bTL4F46P0
d-i user-setup/allow-password-weak boolean true

### ===== 分区（整盘 LVM，全自动） =====
# 强烈建议固定目标盘，避免多盘/盘符变化触发交互
d-i partman-auto/disk string /dev/sda

# 使用 LVM 自动分区
d-i partman-auto/method string lvm
d-i partman-auto/choose_recipe select atomic
d-i partman-auto-lvm/guided_size string max
d-i partman-auto-lvm/new_vg_name string vg0

# 清理旧 LVM/RAID 签名，避免弹确认
d-i partman-lvm/device_remove_lvm boolean true
d-i partman-md/device_remove_md boolean true

# 自动确认写入分区表与 LVM 变更（你卡住点）
d-i partman-partitioning/confirm_write_new_label boolean true
d-i partman-lvm/confirm boolean true
d-i partman-lvm/confirm_nooverwrite boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_nooverwrite boolean true

### ===== 软件包 =====
tasksel tasksel/first multiselect standard, openssh-server
d-i pkgsel/include string fish batcat
d-i pkgsel/upgrade select none

### ===== 引导器 =====
d-i grub-installer/only_debian boolean true
d-i grub-installer/with_other_os boolean true

### ===== 安装后命令 =====
d-i preseed/late_command string \
  in-target ln -sf /usr/bin/batcat /usr/local/bin/bat || true
```

### 16.04

###### boot image

```shell
cd /srv/tftp/boot/casper/ubuntu/1604/server
wget http://archive.ubuntu.com/ubuntu/dists/xenial-updates/main/installer-amd64/current/images/netboot/netboot.tar.gz
tar -xzf netboot.tar.gz -C /srv/tftp/boot/casper/ubuntu/1604/server
```

###### preseed

```shell
mkdir -p /var/www/html/ubuntu/preseed/server
nano /var/www/html/ubuntu/preseed/server/ubuntu-1604.cfg
```

```config
### ===== 基础无人值守 =====
# 自动模式，只显示关键问题
d-i auto-install/enable boolean true
d-i debconf/priority select critical

### ===== 语言/键盘/时区 =====
d-i debian-installer/locale string en_US.UTF-8
d-i keyboard-configuration/xkb-keymap select us
d-i time/zone string Asia/Shanghai
d-i clock-setup/utc boolean true
d-i clock-setup/ntp boolean true

### ===== 网络 =====
d-i netcfg/choose_interface select auto
d-i netcfg/get_hostname string ubuntu1804
d-i netcfg/get_domain string local

### ===== 镜像源 =====
d-i mirror/country string manual
d-i mirror/http/hostname string mirrors.aliyun.com
d-i mirror/http/directory string /ubuntu
d-i mirror/http/proxy string

### ===== 用户 =====
d-i passwd/root-login boolean false
d-i passwd/user-fullname string Ubuntu User
d-i passwd/username string ubuntu
d-i passwd/user-password-crypted password $6$exDY1mhS4KUYCE/2$zmn9ToZwTKLhCw.b4/b.ZRTIZM30JZ4QrOQ2aOXJ8yk96xpcCof0kxKwuX1kqLG/ygbJ1f8wxED22bTL4F46P0
d-i user-setup/allow-password-weak boolean true

### ===== 分区（整盘 LVM，全自动） =====
# 强烈建议固定目标盘，避免多盘/盘符变化触发交互
d-i partman-auto/disk string /dev/sda

# 使用 LVM 自动分区
d-i partman-auto/method string lvm
d-i partman-auto/choose_recipe select atomic
d-i partman-auto-lvm/guided_size string max
d-i partman-auto-lvm/new_vg_name string vg0

# 清理旧 LVM/RAID 签名，避免弹确认
d-i partman-lvm/device_remove_lvm boolean true
d-i partman-md/device_remove_md boolean true

# 自动确认写入分区表与 LVM 变更（你卡住点）
d-i partman-partitioning/confirm_write_new_label boolean true
d-i partman-lvm/confirm boolean true
d-i partman-lvm/confirm_nooverwrite boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_nooverwrite boolean true

### ===== 软件包 =====
tasksel tasksel/first multiselect standard, openssh-server
d-i pkgsel/include string fish batcat
d-i pkgsel/upgrade select none

### ===== 引导器 =====
d-i grub-installer/only_debian boolean true
d-i grub-installer/with_other_os boolean true

### ===== 安装后命令 =====
d-i preseed/late_command string \
  in-target ln -sf /usr/bin/batcat /usr/local/bin/bat || true
```

## 2. ipxe bootloader

使用 `pxe` 拉去 `ipxe bootloader`，或者将 `ipxe` 烧录进网卡 `ROM`，

[Configuring PXE Network Boot Server on Ubuntu 22.04 LTS – Linux Hint](https://linuxhint.com/pxe_boot_ubuntu_server/)

### 2.1 dhcp server

[iPXE - open source boot firmware [howto:chainloading]](https://ipxe.org/howto/chainloading)
[iPXE - open source boot firmware [howto:dhcpd]](https://ipxe.org/howto/dhcpd)

```shell
nano /etc/dhcp/dhcpd.conf
```

```shell
option client-arch code 93 = unsigned integer 16;

subnet 192.168.1.0 netmask 255.255.255.0 {
    range 192.168.1.100 192.168.1.200;
    option routers 192.168.1.1;
    # 指定 vm1 的 dns server，即物理网络的 dns server
    option domain-name-servers 10.20.193.2;
    # option domain-name-servers 192.168.17.2;
    next-server 192.168.1.1;

    # 防止循环加载
    if exists user-class and option user-class = "iPXE" {
      # 根据实际环境进行修改
      filename "http://192.168.1.1/ipxe/ipxe_boot_script.php";
    } elsif option client-arch = 00:00 {
        filename "bios/undionly.kpxe";
    } else {
        filename "grub/ipxe.efi";
    }
}
```

```shell
dhcpd -t -cf /etc/dhcp/dhcpd.conf
systemctl restart isc-dhcp-server
```

### 2.2 boot image

```shell
mkdir -p /var/www/html/ubuntu/{2004,2204,2404,2504}/server/casper
cp /srv/tftp/boot/casper/ubuntu/2004/server/{vmlinuz,initrd} /var/www/html/ubuntu/2004/server/casper
cp /srv/tftp/boot/casper/ubuntu/2204/server/{vmlinuz,initrd} /var/www/html/ubuntu/2204/server/casper
cp /srv/tftp/boot/casper/ubuntu/2404/server/{vmlinuz,initrd} /var/www/html/ubuntu/2404/server/casper
cp /srv/tftp/boot/casper/ubuntu/2504/server/{vmlinuz,initrd} /var/www/html/ubuntu/2504/server/casper
```

```shell
mkdir -p /var/www/html/ubuntu/{2004,2204,2404,2504}/desktop/casper
cp /srv/tftp/boot/casper/ubuntu/2004/desktop/{vmlinuz,initrd} /var/www/html/ubuntu/2004/desktop/casper
cp /srv/tftp/boot/casper/ubuntu/2204/desktop/{vmlinuz,initrd} /var/www/html/ubuntu/2204/desktop/casper
cp /srv/tftp/boot/casper/ubuntu/2404/desktop/{vmlinuz,initrd} /var/www/html/ubuntu/2404/desktop/casper
cp /srv/tftp/boot/casper/ubuntu/2504/desktop/{vmlinuz,initrd} /var/www/html/ubuntu/2504/desktop/casper
```

### 2.3 ipxe bootloader

```shell
wget https://boot.ipxe.org/x86_64-efi/ipxe.efi -P /srv/tftp/grub
wget https://boot.ipxe.org/undionly.kpxe -P /srv/tftp/bios
```

> [!failure]+ Asus B365M-K 启动后在 ipxe 启动菜单，键盘无响应
> 使用 snponly.efi 替换 ipxe.efi 后解决，即 dhcp 下发 snponly.efi
>
> ```shell
> wget https://boot.ipxe.org/x86_64-efi/snponly.efi -O /srv/tftp/grub/snponly.efi
> ```

> [!note]+ 自己编译 ipxe bootloader
> **AI回答，待测试**
>
> 1. 安装必要的开发工具
>
> ```shell
> sudo apt update
> sudo apt install -y build-essential liblzma-dev git libiberty-dev
> ```
>
> 2. 下载源码并修改配置
>
> ```shell
> git clone https://github.com/ipxe/ipxe.git
> cd ipxe/src
> ```
>
> 3. 修改产品名称 (实现你的 branding.h/PRODUCT_NAME = iPXE-JKL)
>
> ```shell
> sed -i 's/"iPXE"/"iPXE-JKL"/g' config/defaults.h
> # 启用图形控制台和图像支持
> # 开启 CONSOLE_CMD (控制台命令)
> sed -i 's/\/\/#define CONSOLE_CMD/#define CONSOLE_CMD/' config/general.h
> # 开启 PNG 和 JPG 支持
> sed -i 's/\/\/#define IMAGE_PNG/#define IMAGE_PNG/' config/general.h
> sed -i 's/\/\/#define IMAGE_JPG/#define IMAGE_JPG/' config/general.h
> # 开启 Framebuffer 驱动 (EFI 必需)
> sed -i 's/\/\/#define CONSOLE_FRAMEBUFFER/#define CONSOLE_FRAMEBUFFER/' config/console.h
> ```
>
> 4. 编译你需要的两个版本
>
> ```shell
> # 编译 UEFI 版 (生成 ipxe.efi)
> make bin-x86_64-efi/ipxe.efi
> # 编译 BIOS 版 (生成 undionly.kpxe)
> make bin/undionly.kpxe
> ```
>
> 5. 替换 TFTP 目录下的文件
>
> ```shell
> # 请根据你的实际路径替换
> cp bin-x86_64-efi/ipxe.efi /srv/tftp/grub/ipxe.efi
> cp bin/undionly.kpxe /srv/tftp/bios/undionly.kpxe
> ```

#### ipxe bootloader configuration file

[iPXE - open source boot firmware [cmdline]](https://ipxe.org/cmdline)
[iPXE - open source boot firmware [scripting]](https://ipxe.org/scripting)

```shell
mkdir -p /var/www/html/ipxe
nano /var/www/html/ipxe/ipxe_boot_script.php
```

```shell
#!ipxe
dhcp || goto net_fail

# 根据实际环境进行修改
set base http://192.168.1.1
# cloud-init datasource path
set ds_base ${base}/ubuntu/autoinstall
set iso_path ${base}/ubuntu/iso

console --picture ${base}/ipxe/ipxe.png

:main_menu
menu Ubuntu AutoInstall Menu
item --gap -- ----------------- LTS -----------------
item u2004_server Ubuntu 20.04 Server AutoInstall
item u2004_desktop Ubuntu 20.04 Desktop AutoInstall
item u2204_server Ubuntu 22.04 Server AutoInstall
item u2204_desktop Ubuntu 22.04 Desktop AutoInstall
item u2404_server Ubuntu 24.04 Server AutoInstall
item u2404_desktop Ubuntu 24.04 Desktop AutoInstall
item --gap -- ----------------- Non-LTS -----------------
item u2504_server Ubuntu 25.04 Server AutoInstall
item u2504_desktop Ubuntu 25.04 Desktop AutoInstall
item --gap -- ----------------- Windows -----------------
item win10_mdt Windows 10 MDT Deployment
item --gap -- ----------------- End -----------------
item shell iPXE shell
item reboot Reboot

# 15秒超时默认 24.04
choose --default u2404_desktop --timeout 15000 target || goto main_menu
goto ${target}

:u2004_server
set ver 2004
set flavor server
set iso ubuntu-20.04.6-live-server-amd64.iso
set kpath /ubuntu/2004/server/casper
goto boot_ubuntu

# 使用 server iso 安装 server edition，通过 serverGUI 参数指定 GUI 版本的 user-data，安装 ubuntu-desktop-minimal，配置 NetworkManager
:u2004_desktop
set ver 2004
set flavor serverGUI
set iso ubuntu-20.04.6-live-server-amd64.iso
set kpath /ubuntu/2004/server/casper
goto boot_ubuntu

:u2204_server
set ver 2204
set flavor server
set iso ubuntu-22.04.5-live-server-amd64.iso
set kpath /ubuntu/2204/server/casper
goto boot_ubuntu

# 使用 server iso 安装 server edition，通过 serverGUI 参数指定 GUI 版本的 user-data，安装 ubuntu-desktop-minimal，配置 NetworkManager
:u2204_desktop
set ver 2204
set flavor serverGUI
set iso ubuntu-22.04.5-live-server-amd64.iso
set kpath /ubuntu/2204/server/casper
goto boot_ubuntu

:u2404_server
set ver 2404
set flavor server
set iso ubuntu-24.04.4-live-server-amd64.iso
set kpath /ubuntu/2404/server/casper
goto boot_ubuntu

# 23.04 之后直接使用 desktop iso 安装 desktop edition
:u2404_desktop
set ver 2404
set flavor desktop
set iso ubuntu-24.04.4-desktop-amd64.iso
set kpath /ubuntu/2404/desktop/casper
goto boot_ubuntu

:u2504_server
set ver 2504
set flavor server
set iso ubuntu-25.04-live-server-amd64.iso
set kpath /ubuntu/2504/server/casper
goto boot_ubuntu

:u2504_desktop
set ver 2504
set flavor desktop
set iso ubuntu-25.04-desktop-amd64.iso
set kpath /ubuntu/2504/desktop/casper
goto boot_ubuntu

:boot_ubuntu
set kernel_url ${base}${kpath}/vmlinuz
set initrd_url ${base}${kpath}/initrd
set iso_url ${iso_path}/${iso}

set ds_url ds=nocloud-net;s=${ds_base}/${flavor}/

# 24.04+ 建议加 cloud-config-url=/dev/null（兼容性更稳）
# 或运算符，前面的命令执行成功，结果为真，则跳过执行后面的命令；且不能用换行，会导致逻辑判断失败，无法识别 datasource
iseq ${ver} 2404 && set extra cloud-config-url=/dev/null || iseq ${ver} 2504 && set extra cloud-config-url=/dev/null || set extra

echo Booting Ubuntu ${ver} from ${iso_url}
kernel ${kernel_url} initrd=initrd ip=dhcp boot=casper netboot=url url=${iso_url} autoinstall ${extra} ${ds_url} ---
initrd ${initrd_url}
boot || goto boot_fail

:win10_mdt
set win10_mdt_base ${base}/windows/desktop/10/boot
kernel ${win10_mdt_base}/wimboot
initrd ${win10_mdt_base}/BCD
initrd ${win10_mdt_base}/boot.sdi
initrd -n boot.wim ${win10_mdt_base}/boot.wim
boot || goto boot_fail

:shell
shell
goto main_menu

:boot_fail
echo Boot failed, dropping to shell...
shell

:net_fail
echo DHCP failed
sleep 3
reboot

```

- `ds` 参数最后以 `/` 结尾
- 测试 ubuntu2004 安装失败，给内核参数（kernel行）添加 `initrd=initrd`

### 2.4 autoinstall

```shell
mkdir -p /var/www/html/ubuntu/autoinstall/{server,desktop}
ls /var/www/html/ubuntu/autoinstall/server
cp /var/www/html/ubuntu/autoinstall/server/{user-data,meta-data} /var/www/html/ubuntu/autoinstall/desktop/
```

### ipxe 多版本目录结构设计

使用 `ipxe` 后，除了 `ipxe bootloader` 还放在 `tftp server` 下，`boot image`，`iso`，`cloud-init datasource` 都直接放在 `http server` 下

```shell
/var/www/html
├── index.nginx-debian.html
├── ipxe
│   ├── ipxe_boot_script.php
│   └── ipxe.png
├── ubuntu
│   ├── 2004
│   │   ├── desktop
│   │   │   └── casper
│   │   └── server
│   │       └── casper
│   │           ├── initrd
│   │           └── vmlinuz
│   ├── 2204
│   │   ├── desktop
│   │   │   └── casper
│   │   │       ├── initrd
│   │   │       └── vmlinuz
│   │   └── server
│   │       └── casper
│   │           ├── initrd
│   │           └── vmlinuz
│   ├── 2404
│   │   ├── desktop
│   │   │   └── casper
│   │   │       ├── initrd
│   │   │       └── vmlinuz
│   │   └── server
│   │       └── casper
│   │           ├── initrd
│   │           └── vmlinuz
│   ├── 2504
│   │   ├── desktop
│   │   │   └── casper
│   │   │       ├── initrd
│   │   │       └── vmlinuz
│   │   └── server
│   │       └── casper
│   │           ├── initrd
│   │           └── vmlinuz
│   ├── autoinstall
│   │   ├── desktop
│   │   │   ├── meta-data
│   │   │   └── user-data
│   │   ├── server
│   │   │   ├── meta-data
│   │   │   └── user-data
│   │   └── serverGUI
│   │       ├── meta-data
│   │       └── user-data
│   └── iso
│       ├── ubuntu-18.04.6-live-server-amd64.iso
│       ├── ubuntu-20.04.6-live-server-amd64.iso
│       ├── ubuntu-22.04.5-desktop-amd64.iso
│       ├── ubuntu-22.04.5-live-server-amd64.iso
│       ├── ubuntu-24.04.4-desktop-amd64.iso
│       ├── ubuntu-24.04.4-live-server-amd64.iso
│       ├── ubuntu-25.04-desktop-amd64.iso
│       └── ubuntu-25.04-live-server-amd64.iso
└── windows
    └── desktop
        └── 10
            └── boot
                ├── BCD
                ├── boot.sdi
                ├── boot.wim
                └── wimboot
```

### Windows MDT

#### 准备文件

> [!quote]+ ipxe 引导 mdt boot image
> Ref：https://www.dell.com/support/kbdoc/en-us/000148982/using-tiny-pxe-and-ipxe-to-allow-uefi-pxe-booting-on-non-server-os-or-server-2008
>
> 根据这个帖子，需要获取 mdt 上的 3 个文件，分别从以下目录获取：
>
> ```shell
>  C:\DeploymentShare\Boot\LiteTouchPE_x64.wim
>  C:\DeploymentShare\Boot\x64\Boot\boot.sdi
>  C:\DeploymentShare\Boot\x64\Boot\BCD
> ```
>
> 另外需要从 ipxe 官网下载 `wimboot bootloader` 用来引导 wim 格式的 `boot image`：https://github.com/ipxe/wimboot/releases/latest/download/wimboot

#### 适配了 windows mdt 后的配置

- 适配了 `windows mdt` 的 `http` 目录结构见 [[#ipxe 多版本目录结构设计]]
- 适配了 `windows mdt` 的 `ipxe` 配置文件见 [[#ipxe bootloader configuration file]]
  - [800x600 PNG 背景图片](http://boot.ipxe.org/ipxe.png)

#### 域名问题

> [!question]+ MDTServer 域名解析问题
> 如 [[02 MDT部署流程#深入解析 MDT 流程]] 中所述，`bootstrap.ini` 在 mdt 生成 `boot image` 后，会写入到 `boot image` 的 `\Deploy\Scripts\Bootstrap.ini`，
> 如果 `bootstrap.ini` 中指定的是 `mdt server` 的机器名 `MDTSERVER`，目标机器无法解析这个机器名，会导致安装过程报错。
>
> 实际测试过程中，同时修改了 `Deployment Share` 属性中 `General tab` 下 `Network (UNC) path` 中的域名和 `Rules tab` 下 `Edit Bootstrap.ini` 中的域名，修改后重新生成 `boot image`，最终 ipxe 下发的是这个 _ip 版本的 boot image_，安装过程能成功。
> 之后即使 `mdt server` 上修改的2处域名改回去也不影响，可见实际影响的只有 `boot image` 中的域名，安装环境后续不会读取 `mdt server` 上那2处域名设置，另外猜测实际应该只需要修改 `bootstrap.ini` 中的域名，`Network (UNC) path` 中的域名应该不影响
>
> ![[Pasted image 20260311102644.png]]
> ![[Pasted image 20260311102802.png]]

### 信息上报

使用纯 `Nginx` 做“上报接口”，把 `iPXE` 传来的 `ip`/`mac` 写进独立 `access log` 文件（不需要后端程序）。

#### nginx

```shell
nano /etc/nginx/nginx.conf
```

```config
http {
  # 1) 自定义日志格式（示例：JSON 风格，含查询参）
  log_format ipxe_json escape=json
    '{'
      '"time":"$time_iso8601",'
      '"remote_addr":"$remote_addr",'
      '"method":"$request_method",'
      '"uri":"$request_uri",'
      '"mac":"$arg_mac",'
      '"ip":"$arg_ip",'
      '"uuid":"$arg_uuid",'
      '"board_serial":"$arg_board_serial",'
      '"serial":"$arg_serial",'
      '"asset":"$arg_asset",'
      '"ua":"$http_user_agent"'
    '}';
}
```

```shell
nano /etc/nginx/sites-enabled/default
```

```config
server {
    listen 80;
    server_name _;

    # 2) 接口：/report 仅记录日志并返回 204（无响应体）
    location = /report {
      access_log  /var/log/nginx/ipxe-report.log  ipxe_json;
      return 204;   # 204 No Content
    }
}
```

```shell
nginx -t && systemctl reload nginx
```

#### ipxe

```shell
nano /var/www/html/ipxe_boot_script.php
```

```shell
set rep http://192.168.1.1/report
imgfetch ${rep}?ip=${net0/ip}\&mac=${net0/mac:hexhyp}\&uuid=${uuid}\&board_serial=${board-serial}\&serial=${serial}\&asset=${asset}
```

- 在 iPXE 里 `imgfetch` 的作用是从指定 URI 下载一个文件或资源。但这里下载的 URL 很可能是一个 _接口API_，并不是下载文件。所以实际效果就是*访问这个 URL，把参数传给服务器。*

#### 查看上报信息

_vm2执行pxe启动_

```shell
apt install jq -y
cat /var/log/nginx/ipxe-report.log | jq .
```

```json
{
  "time": "2025-09-21T15:34:56+00:00",
  "remote_addr": "192.168.1.100",
  "method": "GET",
  "uri": "/report?ip=192.168.1.100\\&mac=00-0c-29-72-5b-1a\\&uuid=bb034d56-2157-c38b-879a-5ffcea725b1a\\&board_serial=None\\&serial=VMware-56%204d%2003%20bb%2057%2021%208b%20c3-87%209a%205f%20fc%20ea%2072%205b%201a\\&asset=No%20Asset%20Tag",
  "mac": "00-0c-29-72-5b-1a\\",
  "ip": "192.168.1.100\\",
  "uuid": "bb034d56-2157-c38b-879a-5ffcea725b1a\\",
  "board_serial": "None\\",
  "serial": "VMware-56%204d%2003%20bb%2057%2021%208b%20c3-87%209a%205f%20fc%20ea%2072%205b%201a\\",
  "asset": "No%20Asset%20Tag",
  "ua": "iPXE/1.21.1+ (g5c49e)"
}
```

## 排查日志

安装时 console 打印的日志，在安装环境和目标系统中都有落盘日志。

### subiquity

```shell
less /var/log/installer/subiquity-server-debug.log
```

- `ctrl + alt + f4`

### curtin

```shell
less /var/log/installer/curtin-install.log
```

```shell
less /var/log/curtin/install.log
```

```shell
cat /var/log/installer/curtin-install/subiquity-curtin-apt.conf
```

- 查看 subiquity 最终传给 curtin 的 apt 配置长什么样

### cloud-init

```shell
less /var/log/cloud-init.log
```

```shell
less /var/log/cloud-init-output.log
```

```shell
cloud-init status --long
```

[^1]: [[启动文件对比汇总#boot image, install image]]

[^2]: [curtin/examples](https://github.com/canonical/curtin/blob/master/examples/apt-source.yaml)
