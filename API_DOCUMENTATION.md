# 欢喜邮件营销系统 API 文档

## 📋 API 概览

### 基础信息
- **Base URL**: `https://your-domain.com/api`
- **API 版本**: v1
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **字符编码**: UTF-8

### 通用响应格式
```typescript
// 成功响应
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## 🔐 认证接口

### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "name": "张三",
      "role": "admin",
      "avatar": "https://example.com/avatar.jpg"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

### 刷新令牌
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "新用户",
  "inviteCode": "INVITE123" // 可选
}
```

### 退出登录
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

## 👤 用户管理接口

### 获取当前用户信息
```http
GET /api/user/profile
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "张三",
    "role": "admin",
    "avatar": "https://example.com/avatar.jpg",
    "emailQuota": {
      "used": 1500,
      "total": 10000,
      "resetDate": "2024-02-01T00:00:00Z"
    },
    "preferences": {
      "timezone": "Asia/Shanghai",
      "language": "zh-CN",
      "notifications": {
        "email": true,
        "browser": true
      }
    }
  }
}
```

### 更新用户信息
```http
PUT /api/user/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "新名称",
  "avatar": "https://example.com/new-avatar.jpg",
  "preferences": {
    "timezone": "Asia/Shanghai",
    "language": "zh-CN"
  }
}
```

### 修改密码
```http
PUT /api/user/password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

## 📧 邮件活动接口

### 获取活动列表
```http
GET /api/campaigns?page=1&limit=20&status=all&search=关键词
Authorization: Bearer <access_token>
```

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 20，最大: 100）
- `status`: 状态筛选（`draft`, `scheduled`, `sending`, `sent`, `paused`, `all`）
- `search`: 搜索关键词
- `sortBy`: 排序字段（`createdAt`, `name`, `scheduledTime`）
- `sortOrder`: 排序方向（`asc`, `desc`）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "campaign-123",
      "name": "春节促销活动",
      "subject": "🎉 春节大促，全场5折起！",
      "status": "sent",
      "recipientCount": 5000,
      "scheduledTime": "2024-01-20T10:00:00Z",
      "createdAt": "2024-01-15T08:30:00Z",
      "updatedAt": "2024-01-20T10:05:00Z",
      "metrics": {
        "sent": 5000,
        "delivered": 4950,
        "opened": 1485,
        "clicked": 297,
        "bounced": 50,
        "unsubscribed": 12,
        "openRate": 0.30,
        "clickRate": 0.20,
        "bounceRate": 0.01
      }
    }
  ],
  "meta": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

### 创建新活动
```http
POST /api/campaigns
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "新年促销活动",
  "subject": "🎊 新年特惠，限时抢购！",
  "content": "<html><body><h1>新年快乐！</h1>...</body></html>",
  "fromName": "欢喜商城",
  "fromEmail": "noreply@huanxi.com",
  "replyTo": "support@huanxi.com",
  "recipients": [
    {
      "email": "user1@example.com",
      "name": "用户1",
      "variables": {
        "firstName": "张",
        "lastName": "三"
      }
    }
  ],
  "scheduledTime": "2024-02-01T10:00:00Z", // 可选，立即发送则不传
  "settings": {
    "trackOpens": true,
    "trackClicks": true,
    "unsubscribeLink": true,
    "sendRate": 100, // 每分钟发送数
    "priority": "normal" // high, normal, low
  },
  "tags": ["促销", "新年"]
}
```

### 获取活动详情
```http
GET /api/campaigns/{campaignId}
Authorization: Bearer <access_token>
```

### 更新活动
```http
PUT /api/campaigns/{campaignId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "更新后的活动名称",
  "subject": "更新后的邮件主题",
  "content": "更新后的邮件内容"
}
```

### 发送活动
```http
POST /api/campaigns/{campaignId}/send
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "scheduledTime": "2024-02-01T10:00:00Z", // 可选，立即发送则不传
  "testMode": false // 测试模式，只发送给测试邮箱
}
```

### 暂停活动
```http
POST /api/campaigns/{campaignId}/pause
Authorization: Bearer <access_token>
```

### 恢复活动
```http
POST /api/campaigns/{campaignId}/resume
Authorization: Bearer <access_token>
```

### 取消活动
```http
POST /api/campaigns/{campaignId}/cancel
Authorization: Bearer <access_token>
```

### 删除活动
```http
DELETE /api/campaigns/{campaignId}
Authorization: Bearer <access_token>
```

## 📊 数据分析接口

### 获取活动统计
```http
GET /api/analytics/campaigns/{campaignId}
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "sent": 5000,
      "delivered": 4950,
      "opened": 1485,
      "clicked": 297,
      "bounced": 50,
      "unsubscribed": 12,
      "complained": 3
    },
    "rates": {
      "deliveryRate": 0.99,
      "openRate": 0.30,
      "clickRate": 0.20,
      "bounceRate": 0.01,
      "unsubscribeRate": 0.0024,
      "complaintRate": 0.0006
    },
    "timeline": [
      {
        "time": "2024-01-20T10:00:00Z",
        "sent": 500,
        "opened": 45,
        "clicked": 12
      }
    ],
    "topLinks": [
      {
        "url": "https://example.com/product1",
        "clicks": 150,
        "uniqueClicks": 120
      }
    ],
    "devices": {
      "desktop": 0.45,
      "mobile": 0.50,
      "tablet": 0.05
    },
    "emailClients": {
      "gmail": 0.40,
      "outlook": 0.25,
      "apple": 0.20,
      "other": 0.15
    }
  }
}
```

### 获取总体统计
```http
GET /api/analytics/overview?period=30d&timezone=Asia/Shanghai
Authorization: Bearer <access_token>
```

**查询参数**:
- `period`: 时间范围（`7d`, `30d`, `90d`, `1y`, `custom`）
- `startDate`: 开始日期（period=custom时必需）
- `endDate`: 结束日期（period=custom时必需）
- `timezone`: 时区

### 获取实时数据
```http
GET /api/analytics/realtime
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "activeUsers": 23,
    "emailsInQueue": 1250,
    "emailsSentToday": 8500,
    "currentSendRate": 85, // 每分钟
    "systemStatus": "healthy",
    "recentActivity": [
      {
        "type": "email_sent",
        "campaignId": "campaign-123",
        "campaignName": "春节促销",
        "count": 100,
        "timestamp": "2024-01-20T14:30:00Z"
      }
    ]
  }
}
```

## 📋 收件人管理接口

### 获取收件人列表
```http
GET /api/recipients?page=1&limit=50&search=关键词&group=分组名称&status=active
Authorization: Bearer <access_token>
```

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 50，最大: 100）
- `search`: 搜索关键词（邮箱、姓名、公司）
- `group`: 分组筛选
- `status`: 状态筛选（`active`, `unsubscribed`, `bounced`, `all`）
- `sortBy`: 排序字段（`email`, `name`, `createdAt`）
- `sortOrder`: 排序方向（`asc`, `desc`）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "recipient-123",
      "email": "user@example.com",
      "name": "张三",
      "phone": "+86 138 0000 0000",
      "company": "科技公司",
      "group": "VIP客户",
      "status": "active",
      "subscribed": true,
      "customFields": {
        "birthday": "1990-01-01",
        "interests": ["科技", "旅游"]
      },
      "stats": {
        "emailsSent": 25,
        "emailsOpened": 18,
        "emailsClicked": 8,
        "lastActivity": "2024-01-20T10:30:00Z"
      },
      "createdAt": "2024-01-01T08:00:00Z",
      "updatedAt": "2024-01-20T10:30:00Z"
    }
  ],
  "meta": {
    "total": 1250,
    "page": 1,
    "limit": 50,
    "hasMore": true,
    "groups": [
      {
        "name": "VIP客户",
        "count": 150
      },
      {
        "name": "潜在客户",
        "count": 300
      }
    ]
  }
}
```

### 添加收件人
```http
POST /api/recipients
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "name": "新用户",
  "phone": "+86 139 0000 0000",
  "company": "新公司",
  "group": "潜在客户",
  "customFields": {
    "source": "官网注册",
    "interests": ["产品A", "产品B"]
  },
  "subscribed": true,
  "tags": ["新用户", "官网"]
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "recipient-456",
    "email": "newuser@example.com",
    "name": "新用户",
    "group": "潜在客户",
    "status": "active",
    "createdAt": "2024-01-20T15:30:00Z"
  },
  "message": "收件人添加成功"
}
```

### 批量导入收件人
```http
POST /api/recipients/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: recipients.csv
group: VIP客户
createNewGroup: false
newGroupName: ""
```

**CSV 文件格式**:
```csv
email,name,phone,company
user1@example.com,张三,138****0001,公司A
user2@example.com,李四,138****0002,公司B
user3@example.com,王五,138****0003,公司C
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "imported": 150,
    "skipped": 5,
    "errors": 2,
    "details": {
      "duplicates": 3,
      "invalidEmails": 2,
      "missingRequired": 0
    },
    "errorRows": [
      {
        "row": 5,
        "email": "invalid-email",
        "error": "邮箱格式无效"
      }
    ]
  },
  "message": "导入完成：成功 150 条，跳过 5 条，错误 2 条"
}
```

### 获取收件人详情
```http
GET /api/recipients/{recipientId}
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "recipient-123",
    "email": "user@example.com",
    "name": "张三",
    "phone": "+86 138 0000 0000",
    "company": "科技公司",
    "group": "VIP客户",
    "status": "active",
    "subscribed": true,
    "customFields": {
      "birthday": "1990-01-01",
      "interests": ["科技", "旅游"],
      "source": "线下活动"
    },
    "tags": ["VIP", "活跃用户"],
    "stats": {
      "emailsSent": 25,
      "emailsOpened": 18,
      "emailsClicked": 8,
      "lastActivity": "2024-01-20T10:30:00Z",
      "openRate": 0.72,
      "clickRate": 0.32
    },
    "history": [
      {
        "type": "email_opened",
        "campaignId": "campaign-123",
        "campaignName": "春节促销",
        "timestamp": "2024-01-20T10:30:00Z"
      },
      {
        "type": "email_clicked",
        "campaignId": "campaign-123",
        "url": "https://example.com/product",
        "timestamp": "2024-01-20T10:35:00Z"
      }
    ],
    "createdAt": "2024-01-01T08:00:00Z",
    "updatedAt": "2024-01-20T10:30:00Z"
  }
}
```

### 更新收件人
```http
PUT /api/recipients/{recipientId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "更新后的姓名",
  "phone": "+86 139 0000 0000",
  "company": "新公司名称",
  "group": "新分组",
  "customFields": {
    "birthday": "1990-01-01",
    "interests": ["更新后的兴趣"]
  },
  "tags": ["更新后的标签"]
}
```

### 批量更新收件人
```http
PUT /api/recipients/batch
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "recipientIds": ["recipient-123", "recipient-456"],
  "updates": {
    "group": "新分组",
    "tags": ["批量更新"]
  }
}
```

### 删除收件人
```http
DELETE /api/recipients/{recipientId}
Authorization: Bearer <access_token>
```

### 批量删除收件人
```http
DELETE /api/recipients/batch
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "recipientIds": ["recipient-123", "recipient-456"]
}
```

### 按分组删除收件人
```http
DELETE /api/recipients/group/{groupName}
Authorization: Bearer <access_token>
```

### 获取分组列表
```http
GET /api/recipients/groups
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "name": "VIP客户",
      "count": 150,
      "createdAt": "2024-01-01T08:00:00Z"
    },
    {
      "name": "潜在客户",
      "count": 300,
      "createdAt": "2024-01-05T10:00:00Z"
    },
    {
      "name": "普通用户",
      "count": 800,
      "createdAt": "2024-01-10T12:00:00Z"
    }
  ],
  "meta": {
    "totalGroups": 3,
    "totalRecipients": 1250
  }
}
```

### 创建分组
```http
POST /api/recipients/groups
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "新分组",
  "description": "分组描述"
}
```

### 重命名分组
```http
PUT /api/recipients/groups/{groupName}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "newName": "更新后的分组名",
  "description": "更新后的描述"
}
```

### 删除分组
```http
DELETE /api/recipients/groups/{groupName}
Authorization: Bearer <access_token>
```

### 导出收件人
```http
GET /api/recipients/export?format=csv&group=VIP客户&status=active
Authorization: Bearer <access_token>
```

**查询参数**:
- `format`: 导出格式（`csv`, `xlsx`）
- `group`: 分组筛选
- `status`: 状态筛选
- `fields`: 导出字段（逗号分隔）

**响应**:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="recipients_20240120.csv"

email,name,phone,company,group,status
user1@example.com,张三,138****0001,公司A,VIP客户,active
user2@example.com,李四,138****0002,公司B,VIP客户,active
```

## 🏷️ 标签管理接口

### 获取标签列表
```http
GET /api/tags?search=关键词&sortBy=name&sortOrder=asc
Authorization: Bearer <access_token>
```

**查询参数**:
- `search`: 搜索关键词
- `sortBy`: 排序字段（`name`, `createdAt`, `usageCount`）
- `sortOrder`: 排序方向（`asc`, `desc`）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "tag-123",
      "name": "VIP客户",
      "color": "#FF5722",
      "description": "重要客户标签",
      "usageCount": 150,
      "createdAt": "2024-01-01T08:00:00Z",
      "updatedAt": "2024-01-20T10:30:00Z"
    },
    {
      "id": "tag-456",
      "name": "潜在客户",
      "color": "#2196F3",
      "description": "有购买意向的客户",
      "usageCount": 300,
      "createdAt": "2024-01-05T10:00:00Z",
      "updatedAt": "2024-01-18T14:20:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "totalUsage": 1250
  }
}
```

### 创建标签
```http
POST /api/tags
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "新标签",
  "color": "#FF5733",
  "description": "标签描述"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "tag-789",
    "name": "新标签",
    "color": "#FF5733",
    "description": "标签描述",
    "usageCount": 0,
    "createdAt": "2024-01-20T15:30:00Z"
  },
  "message": "标签创建成功"
}
```

### 更新标签
```http
PUT /api/tags/{tagId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "更新后的标签名",
  "color": "#4CAF50",
  "description": "更新后的描述"
}
```

### 删除标签
```http
DELETE /api/tags/{tagId}
Authorization: Bearer <access_token>
```

### 获取标签使用统计
```http
GET /api/tags/{tagId}/stats
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "tagId": "tag-123",
    "name": "VIP客户",
    "usageCount": 150,
    "recentUsage": [
      {
        "date": "2024-01-20",
        "count": 5
      },
      {
        "date": "2024-01-19",
        "count": 3
      }
    ],
    "topCampaigns": [
      {
        "campaignId": "campaign-123",
        "campaignName": "春节促销",
        "recipientCount": 50
      }
    ]
  }
}
```

## 📝 邮件模板接口

### 获取模板列表
```http
GET /api/templates?page=1&limit=20&category=promotional&search=关键词&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <access_token>
```

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 20，最大: 50）
- `category`: 分类筛选（`promotional`, `notification`, `welcome`, `other`）
- `search`: 搜索关键词（模板名称、主题）
- `sortBy`: 排序字段（`name`, `createdAt`, `usageCount`）
- `sortOrder`: 排序方向（`asc`, `desc`）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "template-123",
      "name": "促销模板",
      "subject": "{{productName}} 限时优惠！",
      "category": "promotional",
      "thumbnail": "https://example.com/template-thumb.jpg",
      "variables": ["productName", "discount", "validUntil"],
      "usageCount": 25,
      "isDefault": false,
      "createdAt": "2024-01-01T08:00:00Z",
      "updatedAt": "2024-01-20T10:30:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "hasMore": true,
    "categories": [
      {
        "name": "promotional",
        "count": 20
      },
      {
        "name": "notification",
        "count": 15
      },
      {
        "name": "welcome",
        "count": 8
      },
      {
        "name": "other",
        "count": 2
      }
    ]
  }
}
```

### 获取模板详情
```http
GET /api/templates/{templateId}
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "template-123",
    "name": "促销模板",
    "subject": "{{productName}} 限时优惠！",
    "content": "<html><body><h1>亲爱的 {{customerName}}，</h1><p>{{productName}} 现在享受 {{discount}} 优惠...</p></body></html>",
    "textContent": "亲爱的 {{customerName}}，{{productName}} 现在享受 {{discount}} 优惠...",
    "category": "promotional",
    "variables": [
      {
        "name": "productName",
        "type": "string",
        "required": true,
        "description": "产品名称",
        "defaultValue": "我们的产品"
      },
      {
        "name": "customerName",
        "type": "string",
        "required": false,
        "description": "客户姓名",
        "defaultValue": "客户"
      },
      {
        "name": "discount",
        "type": "string",
        "required": true,
        "description": "折扣信息",
        "defaultValue": "特别优惠"
      }
    ],
    "thumbnail": "https://example.com/template-thumb.jpg",
    "previewImages": [
      "https://example.com/previews/template-123-desktop.jpg",
      "https://example.com/previews/template-123-mobile.jpg"
    ],
    "usageCount": 25,
    "isDefault": false,
    "tags": ["促销", "优惠", "产品"],
    "createdAt": "2024-01-01T08:00:00Z",
    "updatedAt": "2024-01-20T10:30:00Z"
  }
}
```

### 创建模板
```http
POST /api/templates
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "新年祝福模板",
  "category": "notification",
  "subject": "🎊 新年快乐，感谢有您！",
  "content": "<html><body><h1>亲爱的 {{customerName}}，</h1><p>新年快乐！感谢您对 {{companyName}} 的支持...</p></body></html>",
  "textContent": "亲爱的 {{customerName}}，新年快乐！感谢您对 {{companyName}} 的支持...",
  "variables": [
    {
      "name": "customerName",
      "type": "string",
      "required": true,
      "description": "客户姓名",
      "defaultValue": "朋友"
    },
    {
      "name": "companyName",
      "type": "string",
      "required": false,
      "description": "公司名称",
      "defaultValue": "我们"
    }
  ],
  "tags": ["新年", "祝福", "感谢"]
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "template-456",
    "name": "新年祝福模板",
    "subject": "🎊 新年快乐，感谢有您！",
    "category": "notification",
    "usageCount": 0,
    "createdAt": "2024-01-20T15:30:00Z"
  },
  "message": "模板创建成功"
}
```

### 更新模板
```http
PUT /api/templates/{templateId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "更新后的模板名",
  "subject": "更新后的主题",
  "content": "<html>更新后的内容...</html>",
  "category": "promotional"
}
```

### 复制模板
```http
POST /api/templates/{templateId}/copy
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "复制的模板名称",
  "category": "promotional"
}
```

### 删除模板
```http
DELETE /api/templates/{templateId}
Authorization: Bearer <access_token>
```

### 预览模板
```http
POST /api/templates/{templateId}/preview
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "variables": {
    "productName": "智能手机",
    "customerName": "张三",
    "discount": "8折"
  },
  "format": "html"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "subject": "智能手机 限时优惠！",
    "content": "<html><body><h1>亲爱的 张三，</h1><p>智能手机 现在享受 8折 优惠...</p></body></html>",
    "textContent": "亲爱的 张三，智能手机 现在享受 8折 优惠..."
  }
}
```

### 获取模板使用统计
```http
GET /api/templates/{templateId}/stats
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "templateId": "template-123",
    "name": "促销模板",
    "usageCount": 25,
    "totalEmailsSent": 5000,
    "averageOpenRate": 0.35,
    "averageClickRate": 0.12,
    "recentUsage": [
      {
        "date": "2024-01-20",
        "campaignCount": 2,
        "emailsSent": 500
      },
      {
        "date": "2024-01-19",
        "campaignCount": 1,
        "emailsSent": 200
      }
    ],
    "topCampaigns": [
      {
        "campaignId": "campaign-123",
        "campaignName": "春节促销活动",
        "emailsSent": 1000,
        "openRate": 0.42,
        "clickRate": 0.15
      }
    ]
  }
}
```

## ⚙️ 系统配置接口

### 获取邮件服务器配置
```http
GET /api/settings/email-servers?status=active&sortBy=name&sortOrder=asc
Authorization: Bearer <access_token>
```

**查询参数**:
- `status`: 状态筛选（`active`, `inactive`, `error`, `all`）
- `sortBy`: 排序字段（`name`, `createdAt`, `lastUsed`）
- `sortOrder`: 排序方向（`asc`, `desc`）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "server-123",
      "name": "阿里云邮件服务",
      "provider": "aliyun",
      "smtp": {
        "host": "smtpdm.aliyun.com",
        "port": 465,
        "secure": true,
        "auth": {
          "user": "username"
        }
      },
      "limits": {
        "dailyLimit": 10000,
        "hourlyLimit": 1000,
        "perMinuteLimit": 50
      },
      "enabled": true,
      "priority": 1,
      "stats": {
        "emailsSent": 8500,
        "successRate": 0.98,
        "lastUsed": "2024-01-20T10:30:00Z",
        "avgResponseTime": 800
      },
      "createdAt": "2024-01-01T08:00:00Z",
      "updatedAt": "2024-01-20T10:30:00Z"
    }
  ],
  "meta": {
    "total": 3,
    "active": 2,
    "inactive": 0,
    "error": 1
  }
}
```

### 获取邮件服务器详情
```http
GET /api/settings/email-servers/{serverId}
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "server-123",
    "name": "阿里云邮件服务",
    "provider": "aliyun",
    "smtp": {
      "host": "smtpdm.aliyun.com",
      "port": 465,
      "secure": true,
      "auth": {
        "user": "username"
      }
    },
    "imap": {
      "host": "imapdm.aliyun.com",
      "port": 993,
      "secure": true,
      "auth": {
        "user": "username"
      }
    },
    "limits": {
      "dailyLimit": 10000,
      "hourlyLimit": 1000,
      "perMinuteLimit": 50
    },
    "enabled": true,
    "priority": 1,
    "stats": {
      "emailsSent": 8500,
      "successRate": 0.98,
      "lastUsed": "2024-01-20T10:30:00Z",
      "avgResponseTime": 800,
      "dailyStats": [
        {
          "date": "2024-01-20",
          "sent": 450,
          "success": 441,
          "failed": 9
        },
        {
          "date": "2024-01-19",
          "sent": 380,
          "success": 372,
          "failed": 8
        }
      ]
    },
    "recentErrors": [
      {
        "timestamp": "2024-01-20T08:30:00Z",
        "error": "SMTP connection timeout",
        "campaignId": "campaign-123"
      }
    ],
    "createdAt": "2024-01-01T08:00:00Z",
    "updatedAt": "2024-01-20T10:30:00Z"
  }
}
```

### 添加邮件服务器
```http
POST /api/settings/email-servers
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "阿里云邮件服务",
  "provider": "aliyun",
  "smtp": {
    "host": "smtpdm.aliyun.com",
    "port": 465,
    "secure": true,
    "auth": {
      "user": "username",
      "pass": "password"
    }
  },
  "imap": {
    "host": "imapdm.aliyun.com",
    "port": 993,
    "secure": true,
    "auth": {
      "user": "username",
      "pass": "password"
    }
  },
  "limits": {
    "dailyLimit": 10000,
    "hourlyLimit": 1000,
    "perMinuteLimit": 50
  },
  "enabled": true,
  "priority": 1,
  "fromName": "您的公司名称",
  "replyTo": "noreply@yourcompany.com"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "server-456",
    "name": "阿里云邮件服务",
    "provider": "aliyun",
    "enabled": false,
    "createdAt": "2024-01-20T15:30:00Z"
  },
  "message": "邮件服务器添加成功，请进行测试验证"
}
```

### 更新邮件服务器
```http
PUT /api/settings/email-servers/{serverId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "更新后的服务器名称",
  "limits": {
    "dailyLimit": 15000,
    "hourlyLimit": 1500
  },
  "priority": 2
}
```

### 测试邮件服务器
```http
POST /api/settings/email-servers/{serverId}/test
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "testEmail": "test@example.com",
  "subject": "邮件服务器测试",
  "content": "这是一封测试邮件，用于验证邮件服务器配置是否正确。"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "testResult": "success",
    "responseTime": 800,
    "messageId": "<test-123@aliyun.com>",
    "details": {
      "connection": "成功连接到 SMTP 服务器",
      "authentication": "身份验证成功",
      "sending": "邮件发送成功"
    }
  },
  "message": "邮件服务器测试成功"
}
```

### 启用/禁用邮件服务器
```http
PUT /api/settings/email-servers/{serverId}/status
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "enabled": true
}
```

### 删除邮件服务器
```http
DELETE /api/settings/email-servers/{serverId}
Authorization: Bearer <access_token>
```

### 获取系统设置
```http
GET /api/settings/general
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "general": {
      "siteName": "欢喜邮件营销系统",
      "siteUrl": "https://yoursite.com",
      "timezone": "Asia/Shanghai",
      "language": "zh-CN"
    },
    "email": {
      "defaultFromName": "您的公司",
      "defaultReplyTo": "noreply@yourcompany.com",
      "trackOpens": true,
      "trackClicks": true,
      "unsubscribeFooter": true
    },
    "sending": {
      "maxEmailsPerHour": 1000,
      "maxRecipientsPerCampaign": 10000,
      "sendingInterval": 60,
      "retryAttempts": 3
    },
    "storage": {
      "maxFileSize": 10485760,
      "allowedFileTypes": ["jpg", "png", "gif", "pdf", "csv", "xlsx"],
      "storageQuota": 1073741824
    }
  }
}
```

### 更新系统设置
```http
PUT /api/settings/general
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "general": {
    "siteName": "新的站点名称",
    "timezone": "Asia/Shanghai"
  },
  "email": {
    "trackOpens": true,
    "trackClicks": true
  }
}
```

## 📈 队列管理接口

### 获取队列状态
```http
GET /api/queue/status?detailed=true&period=1h
Authorization: Bearer <access_token>
```

**查询参数**:
- `detailed`: 是否返回详细信息（默认: false）
- `period`: 统计时间范围（`1h`, `6h`, `24h`, `7d`）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalJobs": 12000,
      "pendingJobs": 350,
      "processingJobs": 15,
      "completedJobs": 11500,
      "failedJobs": 135,
      "isProcessing": true,
      "lastProcessedAt": "2024-01-20T10:30:00Z"
    },
    "queues": {
      "high": {
        "waiting": 0,
        "active": 2,
        "completed": 1500,
        "failed": 5,
        "paused": false,
        "workers": 3,
        "avgProcessTime": 0.8
      },
      "normal": {
        "waiting": 250,
        "active": 10,
        "completed": 8500,
        "failed": 25,
        "paused": false,
        "workers": 10,
        "avgProcessTime": 1.2
      },
      "low": {
        "waiting": 100,
        "active": 3,
        "completed": 2000,
        "failed": 10,
        "paused": false,
        "workers": 2,
        "avgProcessTime": 2.5
      }
    },
    "workers": {
      "total": 15,
      "active": 15,
      "idle": 0,
      "busy": 15
    },
    "performance": {
      "throughput": 85,
      "avgProcessTime": 1.2,
      "errorRate": 0.011,
      "peakThroughput": 120,
      "peakTime": "2024-01-20T14:30:00Z"
    },
    "recentJobs": [
      {
        "id": "job-123",
        "type": "send-email",
        "status": "completed",
        "queue": "normal",
        "campaignId": "campaign-123",
        "recipientEmail": "user@example.com",
        "processedAt": "2024-01-20T10:29:00Z",
        "processingTime": 1100
      },
      {
        "id": "job-124",
        "type": "send-email",
        "status": "failed",
        "queue": "normal",
        "campaignId": "campaign-123",
        "recipientEmail": "invalid@example.com",
        "error": "Invalid email address",
        "failedAt": "2024-01-20T10:28:00Z",
        "retryCount": 3
      }
    ],
    "timeline": [
      {
        "time": "2024-01-20T10:00:00Z",
        "completed": 45,
        "failed": 2
      },
      {
        "time": "2024-01-20T10:15:00Z",
        "completed": 52,
        "failed": 1
      }
    ]
  }
}
```

### 获取队列详细信息
```http
GET /api/queue/{queueName}?page=1&limit=50&status=all
Authorization: Bearer <access_token>
```

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 50，最大: 100）
- `status`: 状态筛选（`waiting`, `active`, `completed`, `failed`, `all`）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "queueName": "normal",
    "stats": {
      "waiting": 250,
      "active": 10,
      "completed": 8500,
      "failed": 25
    },
    "jobs": [
      {
        "id": "job-125",
        "type": "send-email",
        "status": "waiting",
        "priority": 0,
        "data": {
          "campaignId": "campaign-456",
          "recipientEmail": "user2@example.com",
          "templateId": "template-123"
        },
        "createdAt": "2024-01-20T10:30:00Z",
        "attempts": 0
      }
    ]
  },
  "meta": {
    "total": 8785,
    "page": 1,
    "limit": 50,
    "hasMore": true
  }
}
```

### 暂停队列
```http
POST /api/queue/{queueName}/pause
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "queueName": "normal",
    "status": "paused",
    "pausedAt": "2024-01-20T10:30:00Z"
  },
  "message": "队列已暂停"
}
```

### 恢复队列
```http
POST /api/queue/{queueName}/resume
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "queueName": "normal",
    "status": "active",
    "resumedAt": "2024-01-20T10:35:00Z"
  },
  "message": "队列已恢复"
}
```

### 暂停所有队列
```http
POST /api/queue/pause-all
Authorization: Bearer <access_token>
```

### 恢复所有队列
```http
POST /api/queue/resume-all
Authorization: Bearer <access_token>
```

### 重试失败任务
```http
POST /api/queue/retry-failed
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "queueName": "normal",
  "jobIds": ["job-124", "job-125"],
  "maxRetries": 3
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "retriedJobs": 2,
    "skippedJobs": 0,
    "details": [
      {
        "jobId": "job-124",
        "status": "retried",
        "newAttempt": 4
      },
      {
        "jobId": "job-125",
        "status": "retried",
        "newAttempt": 2
      }
    ]
  },
  "message": "已重试 2 个失败任务"
}
```

### 清空失败任务
```http
DELETE /api/queue/failed
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "queueName": "normal",
  "olderThan": "2024-01-19T00:00:00Z"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "deletedJobs": 15,
    "queueName": "normal"
  },
  "message": "已清理 15 个失败任务"
}
```

### 获取任务详情
```http
GET /api/queue/jobs/{jobId}
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "job-123",
    "type": "send-email",
    "status": "completed",
    "queue": "normal",
    "priority": 0,
    "data": {
      "campaignId": "campaign-123",
      "recipientEmail": "user@example.com",
      "templateId": "template-123",
      "variables": {
        "name": "张三",
        "product": "智能手机"
      }
    },
    "result": {
      "messageId": "<msg-123@aliyun.com>",
      "responseTime": 1100
    },
    "attempts": 1,
    "maxAttempts": 3,
    "createdAt": "2024-01-20T10:28:00Z",
    "processedAt": "2024-01-20T10:29:00Z",
    "completedAt": "2024-01-20T10:29:10Z",
    "processingTime": 1100,
    "logs": [
      {
        "timestamp": "2024-01-20T10:29:00Z",
        "level": "info",
        "message": "开始处理邮件发送任务"
      },
      {
        "timestamp": "2024-01-20T10:29:10Z",
        "level": "info",
        "message": "邮件发送成功"
      }
    ]
  }
}
```

### 取消任务
```http
DELETE /api/queue/jobs/{jobId}
Authorization: Bearer <access_token>
```

### 调整队列优先级
```http
PUT /api/queue/{queueName}/priority
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "priority": 10
}
```

### 获取队列统计
```http
GET /api/queue/stats?period=24h&groupBy=hour
Authorization: Bearer <access_token>
```

**查询参数**:
- `period`: 统计时间范围（`1h`, `6h`, `24h`, `7d`, `30d`）
- `groupBy`: 分组方式（`minute`, `hour`, `day`）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "totalJobs": 12000,
    "completedJobs": 11500,
    "failedJobs": 135,
    "avgProcessingTime": 1200,
    "throughputStats": {
      "min": 15,
      "max": 120,
      "avg": 85
    },
    "timeline": [
      {
        "time": "2024-01-20T00:00:00Z",
        "completed": 450,
        "failed": 8,
        "avgProcessingTime": 1100
      },
      {
        "time": "2024-01-20T01:00:00Z",
        "completed": 520,
        "failed": 12,
        "avgProcessingTime": 1250
      }
    ]
  }
}
```

## 🔍 邮件监听接口

### 获取监听状态
```http
GET /api/monitor/status?serverId=server-123
Authorization: Bearer <access_token>
```

**查询参数**:
- `serverId`: 邮件服务器ID（可选，不指定则返回所有服务器状态）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "globalStatus": "running",
    "totalServers": 3,
    "activeServers": 2,
    "servers": [
      {
        "serverId": "server-123",
        "serverName": "Gmail IMAP",
        "status": "running",
        "lastCheck": "2024-01-20T10:30:00Z",
        "connectionStatus": "connected",
        "stats": {
          "totalEmails": 1250,
          "newEmails": 15,
          "repliesDetected": 8,
          "lastEmailTime": "2024-01-20T10:25:00Z"
        },
        "config": {
          "checkInterval": 60,
          "maxEmails": 100,
          "markAsRead": false
        }
      },
      {
        "serverId": "server-456",
        "serverName": "Outlook IMAP",
        "status": "running",
        "lastCheck": "2024-01-20T10:29:00Z",
        "connectionStatus": "connected",
        "stats": {
          "totalEmails": 800,
          "newEmails": 5,
          "repliesDetected": 3,
          "lastEmailTime": "2024-01-20T10:20:00Z"
        },
        "config": {
          "checkInterval": 120,
          "maxEmails": 50,
          "markAsRead": true
        }
      },
      {
        "serverId": "server-789",
        "serverName": "企业邮箱",
        "status": "stopped",
        "lastCheck": "2024-01-20T09:45:00Z",
        "connectionStatus": "disconnected",
        "error": "Authentication failed",
        "stats": {
          "totalEmails": 0,
          "newEmails": 0,
          "repliesDetected": 0,
          "lastEmailTime": null
        }
      }
    ],
    "summary": {
      "totalEmailsToday": 2050,
      "newEmailsToday": 20,
      "repliesToday": 11,
      "avgResponseTime": 3600
    }
  }
}
```

### 获取服务器详细状态
```http
GET /api/monitor/servers/{serverId}/status
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "serverId": "server-123",
    "serverName": "Gmail IMAP",
    "status": "running",
    "connectionStatus": "connected",
    "lastCheck": "2024-01-20T10:30:00Z",
    "nextCheck": "2024-01-20T10:31:00Z",
    "config": {
      "host": "imap.gmail.com",
      "port": 993,
      "secure": true,
      "checkInterval": 60,
      "maxEmails": 100,
      "markAsRead": false,
      "folders": ["INBOX", "Sent"]
    },
    "stats": {
      "totalEmails": 1250,
      "newEmails": 15,
      "repliesDetected": 8,
      "lastEmailTime": "2024-01-20T10:25:00Z",
      "dailyStats": [
        {
          "date": "2024-01-20",
          "emails": 45,
          "replies": 8
        },
        {
          "date": "2024-01-19",
          "emails": 38,
          "replies": 5
        }
      ]
    },
    "recentEmails": [
      {
        "messageId": "<msg-123@gmail.com>",
        "from": "customer@example.com",
        "subject": "Re: 产品咨询",
        "receivedAt": "2024-01-20T10:25:00Z",
        "isReply": true,
        "originalCampaignId": "campaign-123",
        "processed": true
      }
    ],
    "errors": [
      {
        "timestamp": "2024-01-20T09:30:00Z",
        "error": "Connection timeout",
        "resolved": true
      }
    ]
  }
}
```

### 启动监听服务
```http
POST /api/monitor/start
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "serverId": "server-123",
  "config": {
    "checkInterval": 60,
    "maxEmails": 100,
    "markAsRead": false
  }
}
```

**请求参数**:
- `serverId`: 邮件服务器ID（可选，不指定则启动所有服务器）
- `config`: 监听配置（可选）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "serverId": "server-123",
    "status": "starting",
    "message": "邮件监听服务正在启动",
    "estimatedStartTime": "2024-01-20T10:32:00Z"
  },
  "message": "邮件监听启动成功"
}
```

### 停止监听服务
```http
POST /api/monitor/stop
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "serverId": "server-123",
  "graceful": true
}
```

**请求参数**:
- `serverId`: 邮件服务器ID（可选，不指定则停止所有服务器）
- `graceful`: 是否优雅停止（默认: true）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "serverId": "server-123",
    "status": "stopping",
    "message": "邮件监听服务正在停止",
    "estimatedStopTime": "2024-01-20T10:33:00Z"
  },
  "message": "邮件监听停止成功"
}
```

### 重启监听服务
```http
POST /api/monitor/restart
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "serverId": "server-123"
}
```

### 获取监听日志
```http
GET /api/monitor/logs?page=1&limit=50&serverId=server-123&level=info&startDate=2024-01-20&endDate=2024-01-21
Authorization: Bearer <access_token>
```

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 50，最大: 100）
- `serverId`: 服务器ID筛选
- `level`: 日志级别筛选（`debug`, `info`, `warn`, `error`, `all`）
- `startDate`: 开始日期
- `endDate`: 结束日期
- `search`: 搜索关键词

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "log-123",
      "timestamp": "2024-01-20T10:30:00Z",
      "level": "info",
      "serverId": "server-123",
      "serverName": "Gmail IMAP",
      "message": "检测到新邮件回复",
      "details": {
        "messageId": "<msg-123@gmail.com>",
        "from": "customer@example.com",
        "subject": "Re: 产品咨询",
        "campaignId": "campaign-123"
      }
    },
    {
      "id": "log-124",
      "timestamp": "2024-01-20T10:25:00Z",
      "level": "warn",
      "serverId": "server-123",
      "serverName": "Gmail IMAP",
      "message": "连接超时，正在重试",
      "details": {
        "retryCount": 1,
        "maxRetries": 3
      }
    },
    {
      "id": "log-125",
      "timestamp": "2024-01-20T10:20:00Z",
      "level": "error",
      "serverId": "server-789",
      "serverName": "企业邮箱",
      "message": "身份验证失败",
      "details": {
        "error": "Invalid credentials",
        "action": "stopped"
      }
    }
  ],
  "meta": {
    "total": 1250,
    "page": 1,
    "limit": 50,
    "hasMore": true,
    "levels": {
      "debug": 200,
      "info": 800,
      "warn": 150,
      "error": 100
    }
  }
}
```

### 获取邮件回复列表
```http
GET /api/monitor/replies?page=1&limit=50&campaignId=campaign-123&startDate=2024-01-20&processed=false
Authorization: Bearer <access_token>
```

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 50，最大: 100）
- `campaignId`: 活动ID筛选
- `startDate`: 开始日期
- `endDate`: 结束日期
- `processed`: 是否已处理（`true`, `false`, `all`）
- `search`: 搜索关键词（发件人、主题）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "reply-123",
      "messageId": "<msg-123@gmail.com>",
      "from": "customer@example.com",
      "to": "marketing@yourcompany.com",
      "subject": "Re: 春节特惠活动",
      "content": "感谢您的邮件，我对这个产品很感兴趣...",
      "receivedAt": "2024-01-20T10:25:00Z",
      "originalCampaignId": "campaign-123",
      "originalCampaignName": "春节促销活动",
      "originalEmailId": "email-456",
      "recipientId": "recipient-789",
      "serverId": "server-123",
      "processed": false,
      "sentiment": "positive",
      "tags": ["感兴趣", "询价"],
      "attachments": [
        {
          "filename": "business_card.pdf",
          "size": 102400,
          "contentType": "application/pdf"
        }
      ]
    }
  ],
  "meta": {
    "total": 85,
    "page": 1,
    "limit": 50,
    "hasMore": true,
    "stats": {
      "processed": 60,
      "unprocessed": 25,
      "sentiments": {
        "positive": 45,
        "neutral": 30,
        "negative": 10
      }
    }
  }
}
```

### 获取回复详情
```http
GET /api/monitor/replies/{replyId}
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "reply-123",
    "messageId": "<msg-123@gmail.com>",
    "from": "customer@example.com",
    "to": "marketing@yourcompany.com",
    "subject": "Re: 春节特惠活动",
    "content": "感谢您的邮件，我对这个产品很感兴趣，能否提供更详细的价格信息？",
    "htmlContent": "<p>感谢您的邮件，我对这个产品很感兴趣，能否提供更详细的价格信息？</p>",
    "receivedAt": "2024-01-20T10:25:00Z",
    "originalEmail": {
      "campaignId": "campaign-123",
      "campaignName": "春节促销活动",
      "emailId": "email-456",
      "sentAt": "2024-01-19T14:30:00Z",
      "subject": "🎉 春节特惠，限时优惠！"
    },
    "recipient": {
      "id": "recipient-789",
      "email": "customer@example.com",
      "name": "张三",
      "company": "科技公司"
    },
    "server": {
      "id": "server-123",
      "name": "Gmail IMAP"
    },
    "processed": false,
    "sentiment": "positive",
    "confidence": 0.85,
    "tags": ["感兴趣", "询价", "需要跟进"],
    "attachments": [
      {
        "filename": "business_card.pdf",
        "size": 102400,
        "contentType": "application/pdf",
        "downloadUrl": "/api/files/attachments/att-123"
      }
    ],
    "analysis": {
      "keywords": ["感兴趣", "价格", "详细信息"],
      "intent": "inquiry",
      "urgency": "medium",
      "followUpRequired": true
    }
  }
}
```

### 标记回复为已处理
```http
PUT /api/monitor/replies/{replyId}/processed
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "processed": true,
  "notes": "已联系客户，提供了详细报价",
  "tags": ["已跟进", "已报价"]
}
```

### 批量处理回复
```http
PUT /api/monitor/replies/batch
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "replyIds": ["reply-123", "reply-124", "reply-125"],
  "action": "mark_processed",
  "data": {
    "processed": true,
    "tags": ["批量处理"]
  }
}
```

### 更新监听配置
```http
PUT /api/monitor/servers/{serverId}/config
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "checkInterval": 120,
  "maxEmails": 200,
  "markAsRead": true,
  "folders": ["INBOX", "Sent", "Important"],
  "filters": {
    "subjectContains": ["Re:", "回复:"],
    "fromDomains": ["example.com", "customer.com"]
  }
}
```

### 测试监听连接
```http
POST /api/monitor/servers/{serverId}/test
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "connectionTest": "success",
    "responseTime": 800,
    "folderAccess": {
      "INBOX": "accessible",
      "Sent": "accessible",
      "Drafts": "accessible"
    },
    "emailCount": 1250,
    "lastEmail": "2024-01-20T10:25:00Z"
  },
  "message": "监听连接测试成功"
}
```

### 获取监听统计
```http
GET /api/monitor/stats?period=7d&serverId=server-123
Authorization: Bearer <access_token>
```

**查询参数**:
- `period`: 统计时间范围（`1d`, `7d`, `30d`, `90d`）
- `serverId`: 服务器ID筛选

**响应示例**:
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "totalEmails": 850,
    "totalReplies": 125,
    "replyRate": 0.147,
    "avgResponseTime": 4200,
    "sentimentDistribution": {
      "positive": 75,
      "neutral": 35,
      "negative": 15
    },
    "dailyStats": [
      {
        "date": "2024-01-20",
        "emails": 145,
        "replies": 22,
        "replyRate": 0.152
      },
      {
        "date": "2024-01-19",
        "emails": 120,
        "replies": 18,
        "replyRate": 0.150
      }
    ],
    "topCampaigns": [
      {
        "campaignId": "campaign-123",
        "campaignName": "春节促销活动",
        "replies": 45,
        "replyRate": 0.18
      }
    ]
  }
}
```

## 📁 文件管理接口

### 上传文件
```http
POST /api/files/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <file>
type: attachment|template|image|csv|document
folder: <folder_name>
description: <file_description>
```

**请求参数**:
- `file`: 文件内容（必需）
- `type`: 文件类型（必需）
  - `attachment`: 邮件附件
  - `template`: 模板文件
  - `image`: 图片文件
  - `csv`: CSV数据文件
  - `document`: 文档文件
- `folder`: 文件夹名称（可选）
- `description`: 文件描述（可选）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "file-123",
    "filename": "product_catalog.pdf",
    "originalName": "产品目录2024.pdf",
    "size": 2048576,
    "contentType": "application/pdf",
    "type": "attachment",
    "folder": "marketing",
    "description": "2024年产品目录",
    "url": "/api/files/file-123/download",
    "previewUrl": "/api/files/file-123/preview",
    "thumbnailUrl": "/api/files/file-123/thumbnail",
    "uploadedAt": "2024-01-20T10:30:00Z",
    "uploadedBy": {
      "id": "user-123",
      "name": "张三",
      "email": "zhangsan@company.com"
    },
    "metadata": {
      "width": null,
      "height": null,
      "pages": 25,
      "duration": null
    },
    "virus_scan": {
      "status": "clean",
      "scannedAt": "2024-01-20T10:30:05Z"
    }
  },
  "message": "文件上传成功"
}
```

### 批量上传文件
```http
POST /api/files/upload/batch
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

files[]: <file1>
files[]: <file2>
type: attachment
folder: marketing
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "uploaded": [
      {
        "id": "file-123",
        "filename": "image1.jpg",
        "size": 512000,
        "url": "/api/files/file-123/download"
      },
      {
        "id": "file-124",
        "filename": "image2.jpg",
        "size": 768000,
        "url": "/api/files/file-124/download"
      }
    ],
    "failed": [
      {
        "filename": "large_file.zip",
        "error": "文件大小超过限制",
        "code": "FILE_TOO_LARGE"
      }
    ],
    "summary": {
      "total": 3,
      "uploaded": 2,
      "failed": 1,
      "totalSize": 1280000
    }
  }
}
```

### 获取文件列表
```http
GET /api/files?type=attachment&page=1&limit=50&folder=marketing&search=产品&sortBy=uploadedAt&sortOrder=desc
Authorization: Bearer <access_token>
```

**查询参数**:
- `type`: 文件类型筛选（`attachment`, `template`, `image`, `csv`, `document`, `all`）
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 50，最大: 100）
- `folder`: 文件夹筛选
- `search`: 搜索关键词（文件名、描述）
- `sortBy`: 排序字段（`filename`, `size`, `uploadedAt`, `type`）
- `sortOrder`: 排序方向（`asc`, `desc`）
- `uploadedBy`: 上传者ID筛选
- `startDate`: 上传开始日期
- `endDate`: 上传结束日期
- `minSize`: 最小文件大小（字节）
- `maxSize`: 最大文件大小（字节）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "file-123",
      "filename": "product_catalog.pdf",
      "originalName": "产品目录2024.pdf",
      "size": 2048576,
      "sizeFormatted": "2.0 MB",
      "contentType": "application/pdf",
      "type": "attachment",
      "folder": "marketing",
      "description": "2024年产品目录",
      "url": "/api/files/file-123/download",
      "previewUrl": "/api/files/file-123/preview",
      "thumbnailUrl": "/api/files/file-123/thumbnail",
      "uploadedAt": "2024-01-20T10:30:00Z",
      "uploadedBy": {
        "id": "user-123",
        "name": "张三",
        "email": "zhangsan@company.com"
      },
      "usageCount": 15,
      "lastUsed": "2024-01-20T09:15:00Z",
      "isPublic": false,
      "tags": ["产品", "目录", "2024"]
    }
  ],
  "meta": {
    "total": 156,
    "page": 1,
    "limit": 50,
    "hasMore": true,
    "totalSize": 52428800,
    "totalSizeFormatted": "50.0 MB",
    "folders": [
      {
        "name": "marketing",
        "count": 25,
        "size": 15728640
      }
    ],
    "types": {
      "attachment": 85,
      "image": 45,
      "template": 15,
      "csv": 8,
      "document": 3
    }
  }
}
```

### 获取文件详情
```http
GET /api/files/{fileId}
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "file-123",
    "filename": "product_catalog.pdf",
    "originalName": "产品目录2024.pdf",
    "size": 2048576,
    "sizeFormatted": "2.0 MB",
    "contentType": "application/pdf",
    "type": "attachment",
    "folder": "marketing",
    "description": "2024年产品目录",
    "url": "/api/files/file-123/download",
    "previewUrl": "/api/files/file-123/preview",
    "thumbnailUrl": "/api/files/file-123/thumbnail",
    "uploadedAt": "2024-01-20T10:30:00Z",
    "updatedAt": "2024-01-20T10:30:00Z",
    "uploadedBy": {
      "id": "user-123",
      "name": "张三",
      "email": "zhangsan@company.com"
    },
    "usageCount": 15,
    "lastUsed": "2024-01-20T09:15:00Z",
    "isPublic": false,
    "tags": ["产品", "目录", "2024"],
    "metadata": {
      "pages": 25,
      "author": "Marketing Team",
      "title": "Product Catalog 2024"
    },
    "virus_scan": {
      "status": "clean",
      "scannedAt": "2024-01-20T10:30:05Z"
    },
    "usage": [
      {
        "campaignId": "campaign-123",
        "campaignName": "春节促销活动",
        "usedAt": "2024-01-20T09:15:00Z",
        "usageType": "attachment"
      }
    ]
  }
}
```

### 下载文件
```http
GET /api/files/{fileId}/download
Authorization: Bearer <access_token>
```

### 预览文件
```http
GET /api/files/{fileId}/preview
Authorization: Bearer <access_token>
```

### 更新文件信息
```http
PUT /api/files/{fileId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "filename": "updated_catalog.pdf",
  "description": "更新后的产品目录",
  "folder": "marketing/2024",
  "tags": ["产品", "目录", "2024", "更新"],
  "isPublic": false
}
```

### 删除文件
```http
DELETE /api/files/{fileId}
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "fileId": "file-123",
    "filename": "product_catalog.pdf",
    "deletedAt": "2024-01-20T11:30:00Z"
  },
  "message": "文件删除成功"
}
```

### 批量删除文件
```http
DELETE /api/files/batch
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "fileIds": ["file-123", "file-124", "file-125"]
}
```

### 获取存储统计
```http
GET /api/files/stats
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalFiles": 156,
    "totalSize": 52428800,
    "totalSizeFormatted": "50.0 MB",
    "usedQuota": 0.05,
    "quotaLimit": 1073741824,
    "quotaLimitFormatted": "1.0 GB",
    "typeDistribution": {
      "attachment": {
        "count": 85,
        "size": 31457280,
        "percentage": 60.0
      },
      "image": {
        "count": 45,
        "size": 15728640,
        "percentage": 30.0
      }
    }
  }
}
```

## 🔔 通知接口

### 获取通知列表
```http
GET /api/notifications?unread=true&page=1&limit=20&type=campaign&priority=high&startDate=2024-01-20
Authorization: Bearer <access_token>
```

**查询参数**:
- `unread`: 是否只显示未读通知（`true`, `false`, `all`，默认: `all`）
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 20，最大: 100）
- `type`: 通知类型筛选（`campaign`, `system`, `email`, `user`, `all`）
- `priority`: 优先级筛选（`low`, `medium`, `high`, `urgent`, `all`）
- `startDate`: 开始日期
- `endDate`: 结束日期
- `search`: 搜索关键词

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "notification-123",
      "type": "campaign",
      "priority": "high",
      "title": "营销活动发送完成",
      "message": "您的营销活动'春节促销活动'已成功发送给5000位收件人",
      "content": {
        "campaignId": "campaign-123",
        "campaignName": "春节促销活动",
        "totalSent": 5000,
        "successRate": 98.5,
        "completedAt": "2024-01-20T15:30:00Z"
      },
      "isRead": false,
      "createdAt": "2024-01-20T15:30:00Z",
      "readAt": null,
      "actions": [
        {
          "type": "view_campaign",
          "label": "查看活动",
          "url": "/campaigns/campaign-123"
        },
        {
          "type": "view_analytics",
          "label": "查看分析",
          "url": "/analytics/campaign-123"
        }
      ],
      "icon": "📧",
      "color": "success"
    },
    {
      "id": "notification-124",
      "type": "system",
      "priority": "medium",
      "title": "系统维护通知",
      "message": "系统将于今晚23:00-01:00进行维护，期间服务可能暂时不可用",
      "content": {
        "maintenanceStart": "2024-01-20T23:00:00Z",
        "maintenanceEnd": "2024-01-21T01:00:00Z",
        "affectedServices": ["邮件发送", "数据分析"],
        "reason": "系统升级"
      },
      "isRead": true,
      "createdAt": "2024-01-20T10:00:00Z",
      "readAt": "2024-01-20T10:15:00Z",
      "actions": [
        {
          "type": "view_details",
          "label": "查看详情",
          "url": "/system/maintenance"
        }
      ],
      "icon": "🔧",
      "color": "warning"
    },
    {
      "id": "notification-125",
      "type": "email",
      "priority": "urgent",
      "title": "邮件发送失败",
      "message": "营销活动'产品推广'中有150封邮件发送失败",
      "content": {
        "campaignId": "campaign-456",
        "campaignName": "产品推广",
        "failedCount": 150,
        "totalCount": 3000,
        "failureReasons": {
          "invalid_email": 80,
          "bounce": 45,
          "spam_filter": 25
        },
        "failedAt": "2024-01-20T14:20:00Z"
      },
      "isRead": false,
      "createdAt": "2024-01-20T14:20:00Z",
      "readAt": null,
      "actions": [
        {
          "type": "retry_failed",
          "label": "重试失败邮件",
          "url": "/campaigns/campaign-456/retry"
        },
        {
          "type": "view_failed",
          "label": "查看失败列表",
          "url": "/campaigns/campaign-456/failed"
        }
      ],
      "icon": "❌",
      "color": "error"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "hasMore": true,
    "unreadCount": 12,
    "summary": {
      "byType": {
        "campaign": 20,
        "system": 15,
        "email": 8,
        "user": 2
      },
      "byPriority": {
        "urgent": 3,
        "high": 8,
        "medium": 25,
        "low": 9
      }
    }
  }
}
```

### 获取通知详情
```http
GET /api/notifications/{notificationId}
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "notification-123",
    "type": "campaign",
    "priority": "high",
    "title": "营销活动发送完成",
    "message": "您的营销活动'春节促销活动'已成功发送给5000位收件人",
    "content": {
      "campaignId": "campaign-123",
      "campaignName": "春节促销活动",
      "totalSent": 5000,
      "successRate": 98.5,
      "completedAt": "2024-01-20T15:30:00Z",
      "statistics": {
        "sent": 5000,
        "delivered": 4925,
        "opened": 1970,
        "clicked": 590,
        "bounced": 75,
        "unsubscribed": 12
      }
    },
    "isRead": false,
    "createdAt": "2024-01-20T15:30:00Z",
    "readAt": null,
    "updatedAt": "2024-01-20T15:30:00Z",
    "actions": [
      {
        "type": "view_campaign",
        "label": "查看活动",
        "url": "/campaigns/campaign-123",
        "method": "GET"
      },
      {
        "type": "view_analytics",
        "label": "查看分析",
        "url": "/analytics/campaign-123",
        "method": "GET"
      },
      {
        "type": "export_report",
        "label": "导出报告",
        "url": "/api/campaigns/campaign-123/export",
        "method": "POST"
      }
    ],
    "icon": "📧",
    "color": "success",
    "metadata": {
      "source": "campaign_service",
      "version": "1.0",
      "tags": ["营销", "完成", "成功"]
    }
  }
}
```

### 标记通知为已读
```http
PUT /api/notifications/{notificationId}/read
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "notificationId": "notification-123",
    "isRead": true,
    "readAt": "2024-01-20T16:00:00Z"
  },
  "message": "通知已标记为已读"
}
```

### 标记通知为未读
```http
PUT /api/notifications/{notificationId}/unread
Authorization: Bearer <access_token>
```

### 标记所有通知为已读
```http
PUT /api/notifications/read-all
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "type": "campaign",
  "olderThan": "2024-01-19T00:00:00Z"
}
```

**请求参数**:
- `type`: 通知类型筛选（可选）
- `olderThan`: 只标记指定时间之前的通知（可选）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "markedCount": 25,
    "remainingUnread": 3
  },
  "message": "已标记25条通知为已读"
}
```

### 删除通知
```http
DELETE /api/notifications/{notificationId}
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "notificationId": "notification-123",
    "deletedAt": "2024-01-20T16:30:00Z"
  },
  "message": "通知删除成功"
}
```

### 批量删除通知
```http
DELETE /api/notifications/batch
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "notificationIds": ["notification-123", "notification-124"],
  "deleteAll": false,
  "filters": {
    "type": "system",
    "isRead": true,
    "olderThan": "2024-01-15T00:00:00Z"
  }
}
```

**请求参数**:
- `notificationIds`: 要删除的通知ID列表（与deleteAll互斥）
- `deleteAll`: 是否删除所有符合条件的通知（与notificationIds互斥）
- `filters`: 删除条件筛选（当deleteAll为true时使用）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "deletedCount": 15,
    "failedCount": 0,
    "deletedIds": ["notification-123", "notification-124"]
  },
  "message": "成功删除15条通知"
}
```

### 获取通知统计
```http
GET /api/notifications/stats?period=7d
Authorization: Bearer <access_token>
```

**查询参数**:
- `period`: 统计时间范围（`1d`, `7d`, `30d`, `90d`）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "total": 156,
    "unread": 12,
    "readRate": 0.923,
    "byType": {
      "campaign": {
        "total": 85,
        "unread": 5,
        "percentage": 54.5
      },
      "system": {
        "total": 45,
        "unread": 3,
        "percentage": 28.8
      },
      "email": {
        "total": 20,
        "unread": 3,
        "percentage": 12.8
      },
      "user": {
        "total": 6,
        "unread": 1,
        "percentage": 3.9
      }
    },
    "byPriority": {
      "urgent": 8,
      "high": 25,
      "medium": 95,
      "low": 28
    },
    "dailyStats": [
      {
        "date": "2024-01-20",
        "total": 25,
        "unread": 5
      },
      {
        "date": "2024-01-19",
        "total": 18,
        "unread": 2
      }
    ],
    "avgResponseTime": 1800,
    "mostActiveHours": [9, 14, 16]
  }
}
```

### 更新通知偏好设置
```http
PUT /api/notifications/preferences
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "emailNotifications": {
    "campaign": true,
    "system": true,
    "email": false,
    "user": true
  },
  "pushNotifications": {
    "campaign": true,
    "system": false,
    "email": true,
    "user": false
  },
  "frequency": {
    "immediate": ["urgent", "high"],
    "hourly": ["medium"],
    "daily": ["low"]
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00",
    "timezone": "Asia/Shanghai"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "preferences": {
      "emailNotifications": {
        "campaign": true,
        "system": true,
        "email": false,
        "user": true
      },
      "pushNotifications": {
        "campaign": true,
        "system": false,
        "email": true,
        "user": false
      },
      "frequency": {
        "immediate": ["urgent", "high"],
        "hourly": ["medium"],
        "daily": ["low"]
      },
      "quietHours": {
        "enabled": true,
        "start": "22:00",
        "end": "08:00",
        "timezone": "Asia/Shanghai"
      }
    },
    "updatedAt": "2024-01-20T17:00:00Z"
  },
  "message": "通知偏好设置更新成功"
}
```

### 获取通知偏好设置
```http
GET /api/notifications/preferences
Authorization: Bearer <access_token>
```

### 测试通知
```http
POST /api/notifications/test
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "type": "campaign",
  "priority": "medium",
  "channels": ["email", "push"]
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "testNotificationId": "test-notification-123",
    "sentChannels": ["email", "push"],
    "sentAt": "2024-01-20T17:30:00Z"
  },
  "message": "测试通知发送成功"
}
```

## 🏥 健康检查接口

### 系统健康检查
```http
GET /api/health?detailed=true&component=all
```

**查询参数**:
- `detailed`: 是否返回详细信息（`true`, `false`，默认: `false`）
- `component`: 检查特定组件（`database`, `redis`, `email`, `queue`, `storage`, `all`）

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T18:00:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "environment": "production",
  "components": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "connections": {
        "active": 25,
        "idle": 75,
        "max": 100
      },
      "lastCheck": "2024-01-20T17:59:45Z",
      "details": {
        "host": "db.example.com",
        "port": 5432,
        "database": "email_marketing",
        "version": "PostgreSQL 14.5"
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 3,
      "memory": {
        "used": "256MB",
        "max": "1GB",
        "percentage": 25.6
      },
      "connections": {
        "clients": 15,
        "max": 1000
      },
      "lastCheck": "2024-01-20T17:59:50Z",
      "details": {
        "host": "redis.example.com",
        "port": 6379,
        "version": "Redis 6.2.7"
      }
    },
    "email": {
      "status": "healthy",
      "responseTime": 120,
      "servers": [
        {
          "id": "smtp-1",
          "host": "smtp.gmail.com",
          "status": "healthy",
          "lastTest": "2024-01-20T17:55:00Z",
          "successRate": 99.8
        },
        {
          "id": "smtp-2",
          "host": "smtp.outlook.com",
          "status": "healthy",
          "lastTest": "2024-01-20T17:55:00Z",
          "successRate": 99.5
        }
      ],
      "lastCheck": "2024-01-20T17:55:00Z"
    },
    "queue": {
      "status": "healthy",
      "responseTime": 8,
      "queues": {
        "email_send": {
          "status": "active",
          "pending": 150,
          "processing": 5,
          "failed": 2,
          "completed": 9843
        },
        "email_track": {
          "status": "active",
          "pending": 25,
          "processing": 2,
          "failed": 0,
          "completed": 5621
        }
      },
      "workers": {
        "active": 10,
        "idle": 5,
        "max": 20
      },
      "lastCheck": "2024-01-20T17:59:55Z"
    },
    "storage": {
      "status": "healthy",
      "responseTime": 25,
      "disk": {
        "used": "45GB",
        "total": "100GB",
        "percentage": 45.0,
        "available": "55GB"
      },
      "files": {
        "total": 15420,
        "templates": 156,
        "attachments": 8934,
        "exports": 6330
      },
      "lastCheck": "2024-01-20T17:59:30Z"
    }
  },
  "metrics": {
    "requests": {
      "total": 125430,
      "success": 124856,
      "error": 574,
      "successRate": 99.54
    },
    "performance": {
      "avgResponseTime": 85,
      "p95ResponseTime": 250,
      "p99ResponseTime": 500
    },
    "resources": {
      "cpu": {
        "usage": 35.2,
        "cores": 8
      },
      "memory": {
        "used": "2.1GB",
        "total": "8GB",
        "percentage": 26.25
      }
    }
  },
  "alerts": [
    {
      "level": "warning",
      "component": "storage",
      "message": "磁盘使用率接近50%",
      "timestamp": "2024-01-20T17:45:00Z"
    }
  ]
}
```

### 简化健康检查
```http
GET /api/health/simple
```

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T18:00:00Z",
  "version": "1.0.0",
  "uptime": 86400
}
```

### 就绪检查
```http
GET /api/health/ready?timeout=5000
```

**查询参数**:
- `timeout`: 检查超时时间（毫秒，默认: 3000）

**响应示例**:
```json
{
  "ready": true,
  "timestamp": "2024-01-20T18:00:00Z",
  "checks": {
    "database": {
      "ready": true,
      "responseTime": 15
    },
    "redis": {
      "ready": true,
      "responseTime": 3
    },
    "queue": {
      "ready": true,
      "responseTime": 8
    }
  },
  "totalResponseTime": 26
}
```

### 存活检查
```http
GET /api/health/live
```

**响应示例**:
```json
{
  "alive": true,
  "timestamp": "2024-01-20T18:00:00Z",
  "pid": 12345,
  "uptime": 86400
}
```

### 组件健康检查
```http
GET /api/health/components/{component}
```

**路径参数**:
- `component`: 组件名称（`database`, `redis`, `email`, `queue`, `storage`）

**响应示例**（数据库组件）:
```json
{
  "component": "database",
  "status": "healthy",
  "timestamp": "2024-01-20T18:00:00Z",
  "responseTime": 15,
  "details": {
    "host": "db.example.com",
    "port": 5432,
    "database": "email_marketing",
    "version": "PostgreSQL 14.5",
    "connections": {
      "active": 25,
      "idle": 75,
      "max": 100,
      "usage": 25.0
    },
    "performance": {
      "queryTime": 12,
      "slowQueries": 0,
      "lockWaits": 0
    }
  }
}
```

### 系统指标
```http
GET /api/health/metrics?period=1h&interval=5m
```

**查询参数**:
- `period`: 时间范围（`5m`, `15m`, `1h`, `6h`, `24h`）
- `interval`: 数据间隔（`1m`, `5m`, `15m`, `1h`）

**响应示例**:
```json
{
  "period": "1h",
  "interval": "5m",
  "timestamp": "2024-01-20T18:00:00Z",
  "metrics": {
    "requests": [
      {
        "timestamp": "2024-01-20T17:55:00Z",
        "total": 1250,
        "success": 1245,
        "error": 5,
        "avgResponseTime": 85
      }
    ],
    "resources": [
      {
        "timestamp": "2024-01-20T17:55:00Z",
        "cpu": 35.2,
        "memory": 26.25,
        "disk": 45.0
      }
    ]
  },
  "summary": {
    "avgResponseTime": 88.5,
    "successRate": 99.6,
    "totalRequests": 14750,
    "totalErrors": 58
  }
}
```

### 触发手动健康检查
```http
POST /api/health/check
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "components": ["database", "redis", "queue"],
  "detailed": true,
  "timeout": 5000
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "checkId": "check-123",
    "status": "completed",
    "startedAt": "2024-01-20T18:00:00Z",
    "completedAt": "2024-01-20T18:00:03Z",
    "duration": 3000,
    "results": {
      "database": {
        "status": "healthy",
        "responseTime": 15
      },
      "redis": {
        "status": "healthy",
        "responseTime": 3
      },
      "queue": {
        "status": "healthy",
        "responseTime": 8
      }
    }
  }
}
```

## 📊 WebSocket 实时接口

### 连接 WebSocket
```javascript
const ws = new WebSocket('wss://your-domain.com/api/ws');

// 认证
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-jwt-token'
}));

// 订阅事件
ws.send(JSON.stringify({
  type: 'subscribe',
  events: ['campaign.progress', 'queue.status', 'email.sent']
}));
```

### WebSocket 事件类型

#### 活动进度更新
```json
{
  "type": "campaign.progress",
  "data": {
    "campaignId": "campaign-123",
    "progress": {
      "sent": 1500,
      "total": 5000,
      "percentage": 30,
      "estimatedCompletion": "2024-01-20T16:30:00Z"
    }
  }
}
```

#### 队列状态更新
```json
{
  "type": "queue.status",
  "data": {
    "queueSize": 250,
    "activeWorkers": 15,
    "throughput": 85
  }
}
```

#### 邮件发送事件
```json
{
  "type": "email.sent",
  "data": {
    "campaignId": "campaign-123",
    "recipientEmail": "user@example.com",
    "status": "sent",
    "timestamp": "2024-01-20T15:30:00Z"
  }
}
```

## 🚨 错误代码说明

### 认证错误 (4xx)
- `AUTH_001`: 无效的访问令牌
- `AUTH_002`: 访问令牌已过期
- `AUTH_003`: 无效的刷新令牌
- `AUTH_004`: 权限不足
- `AUTH_005`: 账户已被禁用

### 业务错误 (4xx)
- `CAMPAIGN_001`: 活动不存在
- `CAMPAIGN_002`: 活动状态不允许此操作
- `CAMPAIGN_003`: 收件人列表为空
- `CAMPAIGN_004`: 邮件配额不足
- `CAMPAIGN_005`: 活动名称已存在

### 系统错误 (5xx)
- `SYSTEM_001`: 数据库连接失败
- `SYSTEM_002`: 邮件服务器连接失败
- `SYSTEM_003`: 队列服务不可用
- `SYSTEM_004`: 文件存储服务不可用
- `SYSTEM_005`: 内部服务器错误

## 📝 使用示例

### JavaScript/TypeScript 客户端
```typescript
class EmailMarketingAPI {
  private baseURL = 'https://your-domain.com/api';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  // 获取活动列表
  async getCampaigns(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/campaigns?${query}`);
  }

  // 创建活动
  async createCampaign(campaign: CreateCampaignRequest) {
    return this.request('/campaigns', {
      method: 'POST',
      body: JSON.stringify(campaign),
    });
  }

  // 发送活动
  async sendCampaign(campaignId: string, options?: {
    scheduledTime?: string;
    testMode?: boolean;
  }) {
    return this.request(`/campaigns/${campaignId}/send`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }
}

// 使用示例
const api = new EmailMarketingAPI('your-access-token');

// 创建并发送活动
async function createAndSendCampaign() {
  try {
    // 创建活动
    const campaign = await api.createCampaign({
      name: '新年促销',
      subject: '🎊 新年特惠来袭！',
      content: '<h1>新年快乐！</h1><p>全场商品5折起...</p>',
      fromName: '欢喜商城',
      fromEmail: 'noreply@huanxi.com',
      recipients: [
        { email: 'user1@example.com', name: '张三' },
        { email: 'user2@example.com', name: '李四' },
      ],
      settings: {
        trackOpens: true,
        trackClicks: true,
        sendRate: 100,
      },
    });

    console.log('活动创建成功:', campaign.data.id);

    // 发送活动
    await api.sendCampaign(campaign.data.id, {
      scheduledTime: '2024-02-01T10:00:00Z',
    });

    console.log('活动发送成功');
  } catch (error) {
    console.error('操作失败:', error);
  }
}
```

### Python 客户端示例
```python
import requests
from typing import Dict, List, Optional

class EmailMarketingAPI:
    def __init__(self, base_url: str, access_token: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        })
    
    def get_campaigns(self, page: int = 1, limit: int = 20, 
                     status: str = 'all', search: str = '') -> Dict:
        params = {
            'page': page,
            'limit': limit,
            'status': status,
            'search': search
        }
        response = self.session.get(f'{self.base_url}/campaigns', params=params)
        response.raise_for_status()
        return response.json()
    
    def create_campaign(self, campaign_data: Dict) -> Dict:
        response = self.session.post(f'{self.base_url}/campaigns', json=campaign_data)
        response.raise_for_status()
        return response.json()
    
    def send_campaign(self, campaign_id: str, scheduled_time: Optional[str] = None) -> Dict:
        data = {}
        if scheduled_time:
            data['scheduledTime'] = scheduled_time
        
        response = self.session.post(
            f'{self.base_url}/campaigns/{campaign_id}/send', 
            json=data
        )
        response.raise_for_status()
        return response.json()

# 使用示例
api = EmailMarketingAPI('https://your-domain.com/api', 'your-access-token')

# 获取活动列表
campaigns = api.get_campaigns(page=1, limit=10, status='sent')
print(f"共有 {campaigns['meta']['total']} 个活动")

# 创建新活动
new_campaign = api.create_campaign({
    'name': 'Python 测试活动',
    'subject': '来自 Python 的问候',
    'content': '<h1>Hello from Python!</h1>',
    'fromName': '测试发送者',
    'fromEmail': 'test@example.com',
    'recipients': [
        {'email': 'recipient@example.com', 'name': '收件人'}
    ]
})

print(f"活动创建成功，ID: {new_campaign['data']['id']}")
```

## 🔄 API 版本控制

### 版本策略
- 使用语义化版本控制 (Semantic Versioning)
- 主要版本变更：不兼容的 API 修改
- 次要版本变更：向后兼容的功能性新增
- 修订版本变更：向后兼容的问题修正

### 版本指定
```http
# 通过 Header 指定版本
GET /api/campaigns
API-Version: 1.0
Authorization: Bearer <token>

# 通过 URL 指定版本
GET /api/v1/campaigns
Authorization: Bearer <token>
```

### 弃用策略
- 新版本发布后，旧版本至少维护 6 个月
- 弃用通知会在响应头中包含 `Deprecation` 和 `Sunset` 字段
- 提供迁移指南和工具

## 📋 速率限制

### 限制规则
- **认证用户**: 1000 请求/小时
- **管理员用户**: 5000 请求/小时
- **邮件发送**: 根据套餐限制
- **文件上传**: 100 MB/小时

### 响应头
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
X-RateLimit-Retry-After: 3600
```

### 超限响应
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求频率超限，请稍后重试",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "resetTime": "2024-01-20T16:00:00Z"
    }
  }
}
```

---

## 📞 技术支持

如有 API 使用问题，请联系：
- 📧 邮箱：api-support@huanxi.com
- 📱 微信：huanxi-support
- 🌐 文档：https://docs.huanxi.com
- 🐛 问题反馈：https://github.com/huanxi/email-marketing/issues

---

**本文档会持续更新，请关注版本变更通知。**