# 重复发送邮件问题修复

## 问题描述
用户反馈在邮件发送过程中出现重复发送的情况，日志显示同一个邮箱地址会收到多次相同的邮件。

## 问题分析
通过代码分析发现问题出现在 `src/lib/independent-email-queue.ts` 文件的 `startCampaignQueue` 方法中：

### 原始问题代码
```typescript
async startCampaignQueue(campaignId: string, concurrency: number = 1): Promise<{ success: boolean; error?: string }> {
  try {
    let queue = this.campaignQueues.get(campaignId)
    
    if (!queue) {
      queue = await this.createCampaignQueue(campaignId, 1)
    }

    // 问题：即使队列已存在，仍会执行以下逻辑
    await prisma.campaign.update({ /* ... */ })
    await queue.addCampaignTasks()  // 重复添加任务！
    await queue.start(1)
    // ...
  }
}
```

### 问题原因
1. **重复添加任务**：当队列已存在时，代码仍会调用 `addCampaignTasks()` 方法，导致重复添加邮件任务到队列中
2. **缺少运行状态检查**：没有检查队列是否已经在运行，用户快速多次点击发送按钮会导致重复启动
3. **状态管理混乱**：队列存在但未运行的情况没有正确处理

## 修复方案

### 1. 添加队列运行状态检查
在方法开始时检查队列是否已在运行，如果是则直接返回成功：

```typescript
// 检查队列是否已经在运行
if (queue && queue.isRunning()) {
  console.log(`[IndependentQueueManager] 活动 ${campaignId} 的队列已在运行中，跳过重复启动`)
  return { success: true }
}
```

### 2. 分离队列创建和恢复逻辑
将新建队列和恢复现有队列的逻辑分开处理：

```typescript
if (!queue) {
  // 新建队列：创建、添加任务、启动
  queue = await this.createCampaignQueue(campaignId, 1)
  await prisma.campaign.update({ /* 更新状态 */ })
  await queue.addCampaignTasks()  // 只在新建时添加任务
  await queue.start(1)
} else {
  // 恢复现有队列：直接恢复，不重复添加任务
  await queue.resume()
}
```

### 3. API层面的保护
在 `src/app/api/campaigns/[id]/send/route.ts` 中已有队列运行检查：

```typescript
if (queueManager.isQueueRunning(campaignId)) {
  return NextResponse.json({ error: '活动已在运行中' }, { status: 400 })
}
```

## 修复效果

### 修复前
- 用户快速点击发送按钮会导致重复添加任务
- 同一邮箱可能收到多封相同邮件
- 日志显示重复的"开始发送"和"发送成功"记录

### 修复后
- 队列运行时拒绝重复启动请求
- 只在新建队列时添加任务，避免重复
- 现有队列通过恢复机制继续处理剩余任务
- 确保每个邮箱只收到一封邮件

## 测试建议

1. **快速点击测试**：快速多次点击发送按钮，验证是否会产生重复发送
2. **队列恢复测试**：暂停后恢复发送，验证是否会重复添加任务
3. **日志检查**：查看发送日志，确认没有重复的发送记录
4. **数据库验证**：检查 `SentEmail` 表，确认没有重复的 `campaignId + recipientEmail` 组合

## 相关文件

- `src/lib/independent-email-queue.ts` - 主要修复文件
- `src/app/api/campaigns/[id]/send/route.ts` - API层保护
- `DUPLICATE_COUNT_FIX.md` - 之前的重复计数修复文档

## 注意事项

1. 此修复主要针对独立队列模式（`IndependentEmailQueueManager`）
2. 如果使用其他队列模式，需要类似的修复
3. 建议在生产环境部署前进行充分测试
4. 可以考虑在数据库层面添加唯一索引作为最后防线