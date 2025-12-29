# Vercel 部署指南

## 修复的问题

### 1. TypeScript 编译错误
- **问题**: 多个文件中重复声明了 `global.runningTasks` 类型
- **解决方案**: 创建了统一的类型声明文件 `src/types/global.d.ts`
- **修改的文件**:
  - `src/app/api/campaigns/[id]/send/route.ts`
  - `src/app/api/campaigns/[id]/pause/route.ts`
  - `src/app/api/manual-trigger/route.ts`
  - `src/app/api/cron/process-scheduled-campaigns/route.ts`
  - `src/lib/task-recovery.ts`

### 2. 构建配置优化
- **添加**: `next.config.js` 配置文件
- **优化**: 外部包处理和 webpack 配置
- **更新**: `package.json` 构建脚本

### 3. Vercel 配置优化
- **更新**: `vercel.json` 配置
- **添加**: 构建命令和环境变量配置

## 部署前检查清单

### 必需的环境变量
在 Vercel 项目设置中配置以下环境变量：

```bash
# 数据库
DATABASE_URL="your-postgresql-connection-string"

# NextAuth
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="your-secret-key"

# 可选：邮件监听（如果需要）
IMAP_HOST="imap.gmail.com"
IMAP_PORT=993
IMAP_USER="your-email@gmail.com"
IMAP_PASS="your-app-password"
```

### 数据库设置
1. 使用 Vercel Postgres 或其他 PostgreSQL 服务
2. 确保数据库 URL 正确配置
3. 部署后运行数据库迁移：
   ```bash
   npx prisma db push
   ```

## 部署步骤

1. **连接 GitHub 仓库**
   - 在 Vercel 控制台导入项目
   - 选择正确的 GitHub 仓库

2. **配置环境变量**
   - 在项目设置中添加所有必需的环境变量
   - 确保 `DATABASE_URL` 和 `NEXTAUTH_SECRET` 正确设置

3. **部署**
   - Vercel 会自动检测 Next.js 项目
   - 使用配置的构建命令进行部署

4. **部署后设置**
   - 运行数据库迁移
   - 测试基本功能

## 常见问题解决

### 构建失败
- 检查 TypeScript 错误
- 确保所有依赖正确安装
- 查看构建日志中的具体错误信息

### 数据库连接问题
- 验证 `DATABASE_URL` 格式
- 确保数据库服务可访问
- 检查防火墙设置

### 环境变量问题
- 确保所有必需变量已设置
- 检查变量名拼写
- 重新部署以应用新的环境变量

## 性能优化

### 已实现的优化
- 外部包优化（nodemailer, imap, mailparser）
- SWC 压缩
- Standalone 输出模式

### 建议的优化
- 使用 Vercel Edge Functions（适用的 API 路由）
- 实现适当的缓存策略
- 优化图片和静态资源

## 监控和维护

### 日志监控
- 使用 Vercel 函数日志
- 监控错误率和性能

### 定期维护
- 更新依赖包
- 监控数据库性能
- 备份重要数据

## 部署限制说明

### Cron 任务限制

Vercel 免费版（Hobby Plan）对 cron 任务有以下限制：
- **每日限制**：只能运行一次 cron 任务
- **频率限制**：不支持高频率的定时任务（如每5分钟一次）

### 解决方案

我们已经实施了以下解决方案来应对这些限制：

#### 1. 调整 Cron 频率

**文件**: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/process-scheduled-campaigns",
      "schedule": "0 0 * * *"  // 每天午夜执行一次
    }
  ]
}
```

#### 2. 手动触发机制

**新增 API 端点**: `/api/manual-trigger`
- **POST**: 手动触发定时任务处理
- **GET**: 查看待处理任务状态

**功能特点**：
- 检查所有需要发送的定时活动
- 启动未完成的发送任务
- 提供实时状态反馈

#### 3. 仪表盘集成

在仪表盘页面添加了：
- **自动检测**：页面加载时检查待处理任务
- **手动触发按钮**：当有待处理任务时显示橙色按钮
- **实时更新**：每分钟自动检查一次
- **状态提示**：显示待处理任务数量

## 使用说明

### 定时发送流程

1. **创建定时活动**：在发送活动页面设置未来的发送时间
2. **自动检测**：系统会在仪表盘显示待处理任务数量
3. **手动触发**：点击"处理定时任务"按钮立即执行
4. **自动执行**：每天午夜 cron 任务会自动处理所有待发送任务

### 立即发送流程

立即发送不受 cron 限制影响，会直接启动发送任务。

## 技术实现

### 任务恢复机制

使用 `TaskRecoveryService` 确保：
- 应用重启后恢复未完成任务
- 防止重复执行同一任务
- 提供任务状态管理

### 全局任务管理

```typescript
declare global {
  var runningTasks: Map<string, {
    isRunning: boolean
    isPaused: boolean
    controller: AbortController
    lastProcessedIndex: number
  }> | undefined
}
```

## 部署建议

### 免费版用户

1. **定期检查**：每天登录仪表盘检查待处理任务
2. **手动触发**：及时点击处理按钮执行定时任务
3. **合理规划**：避免设置过多的定时任务

### 升级到 Pro 版

如果需要更频繁的自动处理，建议升级到 Vercel Pro 版：
- 支持更高频率的 cron 任务
- 更大的执行时间限制
- 更好的性能保障

## 监控和调试

### 日志查看

在 Vercel 控制台的 Functions 标签页可以查看：
- Cron 任务执行日志
- API 调用记录
- 错误信息

### 状态检查

通过以下方式检查系统状态：
1. 仪表盘的待处理任务提示
2. `/api/manual-trigger` GET 请求
3. 发送活动页面的任务状态

## 故障排除

### 常见问题

1. **任务未执行**
   - 检查 cron 任务是否正常运行
   - 使用手动触发功能
   - 查看 Vercel 函数日志

2. **重复发送**
   - 任务管理机制会防止重复执行
   - 检查数据库中的任务状态

3. **性能问题**
   - 单次处理大量邮件可能超时
   - 考虑分批处理或升级计划

## 总结

通过以上解决方案，系统在 Vercel 免费版上仍能正常运行，只需要用户偶尔手动触发定时任务处理。这是一个平衡成本和功能的有效方案。