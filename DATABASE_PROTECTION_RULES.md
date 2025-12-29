# 数据库保护规则 🛡️

## 🚨 核心原则：绝对禁止删除数据库和清除数据

### ❌ 严格禁止的操作

#### 1. 数据库删除操作
```sql
-- 绝对禁止以下操作：
DROP DATABASE email_marketing;
DROP TABLE campaigns;
DROP TABLE emails;
DROP TABLE recipients;
DROP TABLE email_profiles;
-- 以及任何其他DROP操作
```

#### 2. 数据清除操作
```sql
-- 绝对禁止以下操作：
DELETE FROM campaigns;
DELETE FROM emails;
DELETE FROM recipients;
TRUNCATE TABLE campaigns;
TRUNCATE TABLE emails;
-- 以及任何清空表数据的操作
```

#### 3. 重置操作
```bash
# 绝对禁止以下命令：
npx prisma db push --force-reset
npx prisma migrate reset
npx prisma db seed --reset
# 以及任何重置数据库的命令
```

### ✅ 允许的数据库操作

#### 1. 数据查询操作
```sql
-- 允许的查询操作：
SELECT * FROM campaigns;
SELECT COUNT(*) FROM emails;
SELECT * FROM recipients WHERE campaign_id = ?;
```

#### 2. 数据更新操作
```sql
-- 允许的更新操作：
UPDATE campaigns SET status = 'COMPLETED' WHERE id = ?;
UPDATE emails SET status = 'SENT' WHERE id = ?;
```

#### 3. 数据插入操作
```sql
-- 允许的插入操作：
INSERT INTO campaigns (name, subject, content) VALUES (?, ?, ?);
INSERT INTO emails (campaign_id, recipient_email) VALUES (?, ?);
```

#### 4. 结构优化操作
```sql
-- 允许的结构优化：
CREATE INDEX idx_campaign_status ON campaigns(status);
CREATE INDEX idx_email_status ON emails(status);
ALTER TABLE campaigns ADD COLUMN new_field VARCHAR(255);
```

### 🔧 安全的数据库变更流程

#### 1. 使用Prisma迁移
```bash
# 正确的数据库变更方式：
npx prisma migrate dev --name add_new_feature
npx prisma generate
npx prisma db push  # 仅用于开发环境
```

#### 2. 备份优先原则
```bash
# 重大变更前必须备份：
pg_dump email_marketing > backup_$(date +%Y%m%d_%H%M%S).sql
# 或使用其他数据库的备份命令
```

#### 3. 测试环境验证
- 所有数据库变更必须先在测试环境验证
- 确认变更不会影响现有数据
- 验证应用程序兼容性

### 📊 数据完整性保护

#### 1. 外键约束保护
- 保持所有外键约束不变
- 新增关系时必须定义适当的外键
- 删除字段前确认没有外键依赖

#### 2. 数据一致性检查
```sql
-- 定期检查数据一致性：
SELECT COUNT(*) FROM campaigns WHERE status NOT IN ('DRAFT', 'SENDING', 'COMPLETED', 'FAILED', 'PAUSED', 'STOPPED');
SELECT COUNT(*) FROM emails WHERE status NOT IN ('PENDING', 'SENT', 'FAILED', 'BOUNCED');
```

#### 3. 数据验证规则
- 所有必填字段必须有NOT NULL约束
- 枚举字段必须有CHECK约束
- 日期字段必须有合理的范围限制

### 🚨 紧急情况处理

#### 1. 数据恢复计划
- 定期自动备份（每日、每周）
- 备份文件异地存储
- 制定详细的恢复流程文档

#### 2. 监控和告警
- 监控数据库连接数
- 监控表大小变化
- 设置异常操作告警

#### 3. 访问控制
- 限制数据库管理员权限
- 记录所有数据库操作日志
- 定期审计数据库访问

### 📝 开发团队责任

#### 1. 代码审查要求
- 所有涉及数据库的代码必须经过审查
- 重点检查是否包含删除或清除操作
- 确认数据操作的安全性

#### 2. 测试要求
- 编写数据库操作的单元测试
- 测试数据迁移的安全性
- 验证数据完整性约束

#### 3. 文档要求
- 记录所有数据库变更
- 更新数据模型文档
- 维护变更历史记录

### 🎯 最佳实践

#### 1. 防御性编程
```typescript
// 在代码中添加数据保护检查
if (operation === 'DELETE_ALL' || operation === 'TRUNCATE') {
  throw new Error('数据删除操作被禁止！');
}

// 使用事务确保数据一致性
const result = await prisma.$transaction(async (tx) => {
  // 安全的数据操作
  return await tx.campaign.update({
    where: { id },
    data: { status: 'COMPLETED' }
  });
});
```

#### 2. 配置管理
```env
# 环境变量中禁用危险操作
ALLOW_DATA_DELETION=false
ENABLE_RESET_COMMANDS=false
REQUIRE_BACKUP_BEFORE_MIGRATION=true
```

#### 3. 监控脚本
```bash
#!/bin/bash
# 监控危险操作的脚本
grep -r "DROP\|DELETE\|TRUNCATE" src/ && echo "警告：发现潜在的危险数据库操作！"
```

## 🔒 总结

**数据是系统的生命线，保护数据安全是每个开发者的责任！**

- 🚫 **绝不删除**：任何情况下都不允许删除数据库或清除数据
- 🛡️ **安全第一**：所有操作都要以数据安全为前提
- 📋 **流程规范**：严格遵循数据库变更流程
- 🔍 **持续监控**：建立完善的监控和告警机制
- 📚 **团队培训**：确保所有团队成员理解数据保护的重要性

**记住：宁可功能不完美，也不能让数据有丝毫风险！**