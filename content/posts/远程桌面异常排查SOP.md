
#### 1. 应用层面

##### 1.1 RemoteDesktop 程序文件是否损坏（正常情况下不考虑）

`%systemroot%\system32\termsrv.dll（Win1021H2，termsrv.dll version10.0.19041.2075）`

##### 1.2 查看 RemoteDesktop 服务是否在运行

```powershell
Get-Service TermService
```

##### 1.3 RemoteDesktop 设置是否开启

1. `WIN+R`
2. `sysdm.cpl` - `remote tab`
3. `remote desktop section`，勾选 `allow remote connections to this computer`

```powershell
Get-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name "fDenyTSConnections"
```
- `0`：**已开启**远程桌面连接
- `1`：**已禁用**远程桌面连接（拒绝连接）

#### 2. 网络层面

##### 2.1 路由

i. WIN+R，cmd
ii. route print -4，查看到远程网关路由（如果使用远程网关方式）

##### 2.2 查看 RemoteDesktop 防火墙规则是否启用

```powershell
Get-NetFirewallRule -DisplayGroup "Remote Desktop" | select Name, Enabled, Direction, Action
```
- `Win+R` - `wf.msc` - 查看 `Remote Desktop - User Mode (TCP-in)` 和 `Remote Desktop - User Mode (UDP-in)`

#### 3. 系统层面

##### 3.1 电源设置

1. 关闭网卡电源管理
	1. WIN+X，M，打开设备管理器
	2. 选中网卡，右键属性，Power Management选项卡
	3. 取消勾选Allow the computer to turn off this device to save power
	4. 勾选Allow this device to wake the computer
2. 关闭睡眠和休眠
	1. WIN+R，cmd
	2. 关闭睡眠
		1. powercfg /x standby-timeout-ac 0
		2. powercfg /x standby-timeout-dc 0
3. 关闭休眠
	1. powercfg /x hibernate-timeout-ac 0
	2. powercfg /x hibernate-timeout-dc 0

通过修改termsrv.dll或者在TerminalServices和ServiceControlManager之间套用一层RDP Wrapper来实现多会话RDP
How to Allow Multiple RDP Sessions in Windows 10 and 11? | Windows OS Hub (woshub.com)

> [!quote]+ RDP Troubleshooting
> https://learn.microsoft.com/en-us/troubleshoot/windows-server/remote/remote-desktop-services-overview