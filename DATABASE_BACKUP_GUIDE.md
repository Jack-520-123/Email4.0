# 📦 Neon数据库备份指南

为了防止数据丢失，建议定期备份数据库。本指南提供了完整的备份解决方案。

## 🚀 快速开始

### 1. 安装PostgreSQL客户端工具

**方法一：官方安装包**
```bash
# 下载并安装PostgreSQL
# 访问：https://www.postgresql.org/download/windows/
# 下载Windows版本，安装时确保勾选"Command Line Tools"
```

**方法二：使用Chocolatey（推荐）**
```powershell
# 如果没有Chocolatey，先安装：
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 安装PostgreSQL客户端
choco install postgresql
```

**方法三：使用Scoop**
```powershell
# 安装Scoop（如果没有）
iwr -useb get.scoop.sh | iex

# 安装PostgreSQL
scoop install postgresql
```

### 2. 验证安装
```powershell
# 检查pg_dump是否可用
pg_dump --version
```

## 📋 备份脚本使用方法

### 简化版备份（推荐）
```powershell
# 在项目根目录执行
.\backup-simple.ps1
```

### 完整版备份
```powershell
# 在项目根目录执行
.\backup-database.ps1
```

## 📁 备份文件说明

- **文件格式**：`neondb_backup_YYYYMMDD_HHMMSS.sql`
- **文件位置**：项目根目录（简化版）或 `./backups/` 目录（完整版）
- **文件内容**：完整的数据库结构和数据

## 🔄 恢复数据库

如果需要恢复备份的数据：

```powershell
# 恢复数据库（替换YOUR_BACKUP_FILE.sql为实际文件名）
psql $env:DATABASE_URL -f YOUR_BACKUP_FILE.sql
```

## ⚙️ 自动化备份

### 设置定时任务

1. 打开"任务计划程序"
2. 创建基本任务
3. 设置触发器（如每天凌晨2点）
4. 操作选择"启动程序"
5. 程序：`powershell.exe`
6. 参数：`-File "C:\Users\Administrator\Desktop\群发系统\backup-simple.ps1"`

### 批处理文件
创建 `daily-backup.bat`：
```batch
@echo off
cd /d "C:\Users\Administrator\Desktop\群发系统"
powershell.exe -ExecutionPolicy Bypass -File "backup-simple.ps1"
pause
```

## 🛡️ 备份最佳实践

1. **定期备份**：建议每天备份一次
2. **多地存储**：将备份文件复制到云盘或其他设备
3. **测试恢复**：定期测试备份文件是否可以正常恢复
4. **保留策略**：保留最近30天的备份，删除过期文件

## 🔧 故障排除

### 常见错误及解决方案

**错误：pg_dump不是内部或外部命令**
```powershell
# 解决方案：将PostgreSQL添加到PATH环境变量
$env:PATH += ";C:\Program Files\PostgreSQL\16\bin"
```

**错误：连接被拒绝**
- 检查网络连接
- 确认.env文件中的DATABASE_URL正确
- 检查Neon数据库是否正常运行

**错误：权限不足**
```powershell
# 以管理员身份运行PowerShell
Start-Process powershell -Verb RunAs
```

## 📞 技术支持

如果遇到问题：
1. 检查PostgreSQL客户端是否正确安装
2. 确认.env文件配置正确
3. 检查网络连接和数据库状态
4. 查看错误日志获取详细信息

---

**重要提醒**：备份是数据安全的最后一道防线，请务必定期执行备份操作！