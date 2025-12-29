# 邮件监听服务配置指南

本文档详细说明如何配置和使用邮件监听服务，实现自动捕获和处理邮件回复。

## 功能概述

邮件监听服务通过IMAP协议连接到您的邮箱，自动监听新邮件并智能匹配回复与原始发送记录。主要功能包括：

- 🔄 **自动监听**: 定期检查IMAP邮箱中的新邮件
- 🎯 **智能匹配**: 使用多种策略匹配邮件回复与原始发送记录
- 📧 **内容解析**: 自动解析邮件内容，提取关键信息
- 💾 **数据存储**: 自动创建回复记录到数据库
- 📊 **实时监控**: Web界面实时显示监听状态和统计信息

## 环境变量配置

### 必需配置

在 `.env` 文件中添加以下IMAP配置：

```env
# IMAP邮件监听配置
IMAP_HOST=imap.gmail.com          # IMAP服务器地址
IMAP_PORT=993                     # IMAP端口
IMAP_SECURE=true                  # 是否使用SSL/TLS
IMAP_USER=your-email@gmail.com    # 邮箱用户名
IMAP_PASSWORD=your-app-password   # 邮箱密码或应用密码
```

### 可选配置

```env
# 监听行为配置
EMAIL_CHECK_INTERVAL=30           # 检查间隔（秒），默认30秒
MAX_EMAILS_PER_CHECK=50           # 每次检查的最大邮件数，默认50
EMAIL_MONITOR_ENABLED=true        # 是否启用邮件监听，默认true
```

## 主流邮箱配置示例

### Gmail
```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-email@gmail.com
IMAP_PASSWORD=your-app-password   # 需要开启两步验证并生成应用密码
```

**Gmail设置步骤：**
1. 开启两步验证
2. 生成应用密码：Google账户 → 安全性 → 应用密码
3. 使用生成的16位应用密码作为 `IMAP_PASSWORD`

### Outlook/Hotmail
```env
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-email@outlook.com
IMAP_PASSWORD=your-password
```

### QQ邮箱
```env
IMAP_HOST=imap.qq.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-email@qq.com
IMAP_PASSWORD=your-authorization-code  # 需要开启IMAP并获取授权码
```

**QQ邮箱设置步骤：**
1. 登录QQ邮箱 → 设置 → 账户
2. 开启IMAP/SMTP服务
3. 获取授权码作为 `IMAP_PASSWORD`

### 163邮箱
```env
IMAP_HOST=imap.163.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-email@163.com
IMAP_PASSWORD=your-authorization-code  # 需要开启IMAP并获取授权码
```

## 启动方式

### 方式1: Web界面管理（推荐）

1. 启动应用：`npm run dev`
2. 访问邮件监听页面：`http://localhost:3000/email-monitor`
3. 点击"启动"按钮开始监听
4. 实时查看监听状态和统计信息

### 方式2: 命令行启动

```bash
# 使用npm脚本
npm run email-monitor

# 或直接运行
npx tsx src/scripts/start-email-monitor.ts
```

### 方式3: Windows批处理文件

双击 `start-email-monitor.bat` 文件启动服务。

## 匹配策略

系统使用多种策略来匹配邮件回复与原始发送记录：

### 1. Message-ID匹配（最准确）
- 使用邮件头中的 `Message-ID`、`In-Reply-To`、`References` 字段
- 置信度：95%

### 2. 收件人+主题匹配
- 匹配收件人邮箱和主题关键词
- 置信度：80%

### 3. 收件人+时间窗口匹配
- 匹配收件人邮箱和发送时间窗口（默认7天内）
- 置信度：60%

### 4. 仅收件人匹配
- 仅匹配收件人邮箱（最后备选）
- 置信度：40%

## 监控和管理

### Web界面功能

访问 `/email-monitor` 页面可以：

- ✅ 查看服务运行状态
- 📊 查看回复统计（总数、24小时内、最后回复时间）
- ⚙️ 测试IMAP连接
- 🔄 启动/停止/重启服务
- 📋 查看配置信息

### API接口

```bash
# 获取监听状态
GET /api/email-monitor

# 启动服务
POST /api/email-monitor
Content-Type: application/json
{"action": "start"}

# 停止服务
POST /api/email-monitor
Content-Type: application/json
{"action": "stop"}

# 重启服务
POST /api/email-monitor
Content-Type: application/json
{"action": "restart"}

# 测试IMAP连接
PUT /api/email-monitor
```

## 数据库结构

### EmailReply表新增字段

```sql
-- 邮件监听相关字段
messageId     String?   -- 邮件Message-ID
inReplyTo     String?   -- In-Reply-To头
references    String[]  -- References头
isOutgoing    Boolean   -- 是否为发出的回复
matchMethod   String?   -- 匹配方法
confidence    Float?    -- 匹配置信度
processedAt   DateTime? -- 处理时间
```

### SentEmail表新增字段

```sql
-- 用于回复匹配
messageId     String?   -- 邮件Message-ID
```

## 故障排除

### 常见问题

**1. 连接失败**
- 检查IMAP服务器地址和端口
- 确认邮箱已开启IMAP服务
- 验证用户名和密码/授权码

**2. 认证失败**
- Gmail: 确保使用应用密码而非账户密码
- QQ/163: 确保使用授权码而非登录密码
- 检查两步验证设置

**3. 无法接收邮件**
- 检查邮箱中是否有新邮件
- 确认邮件在INBOX文件夹中
- 检查 `EMAIL_CHECK_INTERVAL` 设置

**4. 匹配失败**
- 检查原始邮件是否包含正确的Message-ID
- 确认回复邮件的收件人地址正确
- 查看匹配置信度和方法

### 日志查看

```bash
# 查看服务日志
tail -f logs/email-monitor.log

# 查看错误日志
tail -f logs/error.log
```

### 调试模式

```env
# 启用调试模式
DEBUG=true
LOG_LEVEL=debug
```

## 安全注意事项

1. **密码安全**
   - 使用应用密码而非主密码
   - 定期更换授权码
   - 不要在代码中硬编码密码

2. **网络安全**
   - 始终使用SSL/TLS连接
   - 在生产环境中使用防火墙
   - 限制IMAP访问IP

3. **数据安全**
   - 定期备份邮件回复数据
   - 设置适当的数据库访问权限
   - 考虑邮件内容的隐私保护

## 性能优化

1. **检查频率**
   - 根据邮件量调整 `EMAIL_CHECK_INTERVAL`
   - 高频场景建议15-30秒
   - 低频场景可设置60-300秒

2. **邮件数量**
   - 调整 `MAX_EMAILS_PER_CHECK` 避免超时
   - 建议值：10-100封

3. **数据库优化**
   - 定期清理旧的回复记录
   - 为常用查询字段添加索引

## 扩展功能

### 自定义匹配规则

可以在 `src/lib/reply-matcher.ts` 中添加自定义匹配逻辑：

```typescript
// 添加自定义匹配策略
private async customMatch(email: ParsedEmail): Promise<MatchResult | null> {
  // 实现自定义匹配逻辑
}
```

### 邮件内容处理

可以在 `src/lib/email-parser.ts` 中扩展邮件解析功能：

```typescript
// 添加自定义解析逻辑
public async customParse(content: string): Promise<any> {
  // 实现自定义解析逻辑
}
```

## 技术支持

如果遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查系统日志文件
3. 在GitHub仓库提交Issue
4. 联系技术支持团队

---

**注意**: 邮件监听功能需要稳定的网络连接和正确的邮箱配置。建议在生产环境中使用专用的邮箱账户进行监听。