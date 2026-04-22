

## 1. 系统是否能启动

根据 [[Windows 启动流程]]，系统无法启动，按下列顺序排查：

#### 1.1 硬件问题

1. 按开机键后，完全没反应，黑屏 - 排查硬件
	1. 如 [[开机后风扇转一下又重启]]

2. 风扇都不转，供电是否有问题

3. POST自检失败 - 排查硬件
	- 主板是否板载蜂鸣器；或者有 4pin 的 speaker 接口，用来外接蜂鸣器
	- 主板是否板载 Q-LED诊断灯
	- 主板是否板载数字跑码层（88代码LED屏），或者外接跑码卡

4. 一直卡在主板品牌logo，说明固件已加载且显示设备（至少是集成显卡）已识别 - 排查硬件
	1. 如 [[开关机后卡在Asus logo界面不动]]


思路：

1. 计算机器件为电气设备，优先排除设备内和设备间的电气干扰，拔掉电源放电，重新拔插主板供电线，重新拔插内存条，接最少的设备启动
2. 确保显示器和VGA线是好的
3. 只接电源，内存条，显示器启动，检查主板上的BIOS程序能否加载到内存在主板上显示
4. 再接上系统盘，检查显示器是否有显示（系统内可能没有安装显卡驱动，导致HDMI接口没有输出），检查能否正常进系统

- 启动时，风扇转了一会就停，显示器无显示

解决方案：重新拔插主板供电线，重新拔插内存，最小设备启动即只接一根内存条启动

#### 1.2 启动引导问题

- 如果卡在系统logo，没有转圈圈，仍然属于bootloader末期，Bootloader 正在从磁盘读取内核文件（`ntoskrnl.exe`）以及那些极其关键的“启动驱动”（Boot-Start Drivers）到内存中

#### 1.3 驱动问题：启动引导加载完内核后，内核加载剩余大部分驱动时出问题

- 如果是卡在系统品牌logo+转圈圈，排查重点应该放在内核文件和驱动

在无法进入系统时，参考 [[Windows 启动流程#进入安全模式的几种方法]] 进入安全模式，仅加载必要的驱动和服务启动系统


## 2. 故障点层级


1. 故障点所处层级？是否有常规检查点？

- 比如RDP要检查服务是否启动、设置是否配置、防火墙是否放行等，
- 一些故障如耳机等，除了选择输入输出设备、只涉及硬件和驱动

故障点层级越低，故障率理论上也越低，此类故障可以优先考虑重启，排除偶然性系统bug，如果重启仍然有问题，再按层级排查（比如驱动）
除此之外，层级低的问题如果实在排查不出，可以考虑主板放电（如鼠标乱跳）

2. 运行中的系统总是有莫名其妙的问题，现场是否有没法重启的理由，如果没有，系统重启能否解决问题，先排除下偶然性的系统bug


## 3. 故障上下文

1. 故障出现的时间点是什么，
	1. 询问用户：时间点前后是否人为操作过什么，
	2. 查看日志：时间点前后系统或应用是否自动操作过什么，系统更新、驱动更新、应用更新、应用配置变更等，
		1. 检查系统版本、应用程序版本、驱动版本
		2. 不能确认是否更新过什么，查看是否有system restore point
		3. 能确认更新过什么，手动变更回去

2. 故障影响的范围是什么

3. 正常流程涉及哪些后台服务、后台目录、后台文件、后台驱动等，检查是否异常
	1. 相关日志/事件有哪些


## 问题类型

### 排查硬件导致的无法启动

6. 最小硬件启动
	1. CPU、单内存条、单内存插槽能否启动，再加单系统盘能否启动

7. 各硬件是否有检测工具
	1. 比如内存使用[Windows Memory Diagnostic](https://www.techrepublic.com/article/how-to-detect-bad-ram-with-the-windows-memory-diagnostic-tool/)，[HCI MemTest](https://hcidesign.com/memtest/manual.html)等
	2. 比如硬盘使用各硬盘厂商的硬盘工具，或者三方工具检测坏道和smart等信息

### 系统问题

> 系统无法启动

8. 硬件自检后，BIOS加载到内存运行，先观察BIOS能不能加载运行
	1. 如果不能，先排查硬件故障、静电干扰、内存故障、显卡驱动（固件层驱动如VESA标准）

9. BIOS加载运行后，加载启动条目（这里根据经验应该是会读取磁盘分区表等信息），选择启动条目后，观察启动管理器是否能加载运行，启动管理器读取BCD加载引导条目，再观察引导是否能加载运行

10. 启动引导
	1. 启动模式是什么，分区表是什么
	2. 引导项怎么看

11. 安全模式怎么进入，能否进去
	- 安装模式选项
		- 加载所有设备驱动和服务
	    - 只加载基本的设备驱动和服务
	    - 是否加载系统服务
	    - 是否加载GUI
	    - 是否加载Network
	    - 是否加载Base video

> 驱动

12. 运行Driver Verifier，重启系统，正常使用Windows，使Driver Verifier捕获出问题的驱动，[How to Use Driver Verifier to Fix Common Bluescreen Errors in Windows 10](https://www.makeuseof.com/how-to-use-driver-verifier-windows-10/)

> 系统启动、关机、待机唤醒慢

13. 系统启动是bootloader引导系统内核的过程，系统内核加载驱动和服务，涉及到的基础硬件有CPU、内存、存储、连接线缆，硬件上是否有问题
14. 如果硬件上没问题，系统启动后是否有[性能诊断相关日志](https://eventlogxp.com/blog/windows-boot-performance-diagnostics-1/)，【系统内核启动过程中】以及【加载驱动和服务的过程中】，出现了什么问题
15. 使用[Windows Performance Analyse](https://learn.microsoft.com/en-us/troubleshoot/windows-server/support-tools/support-tools-xperf-wpa-wpr?context=%2Ftroubleshoot%2Fwindows-client%2Fcontext%2Fcontext)分析启动过程

> 系统卡顿

16. 任务管理器taskmgr、资源监视器resmon、进程浏览器procexp64，三件套查看当前CPU、内存、磁盘IO、网络IO占用，性能监视器perfmon设置counter动态监控硬件指标
17. 有哪些和硬件性能相关的事件，有哪些和系统、驱动、应用相关的事件

> 网络卡顿

18. 怎么抓包排查

> 系统崩溃、蓝屏

19. 蓝屏是否频发
	- 启用memory dump转储，使用[WinDbg](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/stop-error-or-blue-screen-error-troubleshooting)分析dmp文件，
20. 系统文件是否损坏
	- dism修复组件仓库和sfc修复已安装的系统镜像
21. 硬件是否有问题，chkdsk检查磁盘




## 应用软件问题

### 日志法

- 应用是否有相关日志

比如 outlook 日志，
22. 事件查看器 - windows logs - application - 过滤日志：事件源 outlook、事件id 1000-1002，
23. outlook - 文件 - 选项 - 高级 - 其他 - 启用疑难解答日志 - 重启outlook，win+r，%temp%目录查看新生成的日志，

### 索引法

- 报错是否有相关的错误消息或错误码

### 常规经验法

以outlook举例，

24. 安全模式启动，排除加载项影响：outlook /safe
25. 重置导航栏，排除一些组件影响：outlook /resetnavpane
26. 删除配置文件，排除配置文件影响：
	- control - mail
	- 注册表删除配置文件：（Outlook2016,2019）Computer\HKEY_CURRENT_USER\SOFTWARE\Microsoft\Office\16.0\Outlook\Profiles，删除Profiles下所有文件夹，每个文件夹对应一个配置文件，有时候注册表仍然有配置文件存在，但是控制面板看不到
27. 关闭兼容模式
28. 修复outlook或修复office，卸载重装
29. 修复数据文件