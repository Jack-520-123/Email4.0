# 邮件发送重复计数问题修复方案

## 问题描述
系统中存在两套并行的邮件发送机制：
1. `route.ts` 中的 `processSendingTask` 函数（直接发送）
2. `email-queue.ts` 中的 `EmailQueueService`（队列发送）

当用户重试发送时，可能导致两套机制同时运行，造成重复计数问题。

## 修复方案

### 1. 邮件队列服务修复 (`src/lib/email-queue.ts`)
- **成功发送检查**：在更新 `sentCount` 前检查是否已存在相同的发送记录
- **失败发送检查**：在更新 `failedCount` 前检查是否已存在相同的失败记录
- **任务添加检查**：在添加邮件任务到队列前检查是否已存在发送记录

### 2. 直接发送机制修复 (`src/app/api/campaigns/[id]/send/route.ts`)
- **成功发送检查**：检查 `sentEmailRecord` 状态，避免重复计数已发送邮件
- **失败发送检查**：在更新 `failedCount` 前检查是否已存在相同的失败记录

### 3. 数据库约束 (`prisma/migrations/add_unique_constraint_sent_email.sql`)
- 添加唯一索引防止同一活动中同一邮箱有多个相同状态的记录
- 清理现有的重复记录

## 运行迁移脚本

```bash
# 在项目根目录执行
psql -d your_database_name -f prisma/migrations/add_unique_constraint_sent_email.sql
```

或者如果使用 SQLite：
```bash
sqlite3 your_database.db < prisma/migrations/add_unique_constraint_sent_email.sql
```

## 安全保障机制

1. **记录级检查**：每次发送前检查是否已存在相同记录
2. **状态检查**：确保只有未发送的邮件才会被计数
3. **数据库约束**：从数据库层面防止重复记录
4. **日志记录**：详细记录跳过重复计数的情况，便于调试

## 测试建议

1. 创建一个测试活动
2. 发送几封邮件后暂停
3. 多次点击继续发送
4. 检查 `sentCount` 和 `failedCount` 是否准确
5. 查看控制台日志确认重复检查机制正常工作

## 注意事项

- 修复后的系统会在控制台输出跳过重复计数的日志
- 数据库迁移脚本会清理现有的重复记录
- 建议在生产环境部署前先在测试环境验证