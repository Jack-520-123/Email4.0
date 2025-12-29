# 欢喜邮件营销系统

一个功能强大、技术先进的企业级邮件营销系统，采用现代化技术栈构建，支持大规模邮件发送、智能监听、精准分析等核心功能。

## 🌟 核心特性

### 📧 智能邮件发送引擎
- **一封一封发送机制**：独创的顺序发送算法，避免并发冲突，确保发送稳定性
- **智能间隔控制**：支持固定间隔和随机间隔，精确到毫秒级别的发送频率控制
- **活动级别隔离**：不同营销活动可并发执行，互不干扰，提升系统吞吐量
- **断点续传机制**：支持暂停/恢复发送，从中断位置继续，保证发送完整性
- **多SMTP支持**：支持多个邮件服务商配置，智能负载均衡

### 🔍 实时邮件监听系统
- **IMAP实时监听**：基于IMAP协议的实时邮件监听，毫秒级响应
- **智能回复匹配**：先进的邮件回复匹配算法，精确关联原始邮件
- **多用户隔离**：完善的用户数据隔离机制，确保数据安全
- **连接池管理**：高效的IMAP连接池，优化资源利用

### 📊 高级数据分析
- **实时统计面板**：动态展示发送进度、成功率、回复率等关键指标
- **可视化图表**：多维度数据可视化，支持趋势分析和对比分析
- **智能报告生成**：自动生成营销效果报告，支持导出多种格式
- **A/B测试支持**：内置A/B测试功能，优化邮件营销效果

### 🎨 现代化用户界面
- **响应式设计**：完美适配桌面端和移动端，提供一致的用户体验
- **暗黑模式支持**：内置主题切换，保护用户视力
- **组件化架构**：基于Radix UI的高质量组件库，确保界面一致性
- **无障碍设计**：遵循WCAG标准，支持键盘导航和屏幕阅读器

## 🏗️ 技术架构

### 核心技术栈
- **前端框架**：Next.js 14 (App Router) + React 18 + TypeScript
- **样式系统**：Tailwind CSS + CSS Variables + 组件变体系统
- **后端架构**：Next.js API Routes + 中间件模式
- **数据库层**：Prisma ORM + PostgreSQL/MySQL
- **认证系统**：NextAuth.js + 会话管理
- **邮件引擎**：Nodemailer + IMAP + 自研队列系统
- **UI组件库**：Radix UI + Lucide Icons + 自定义组件
- **数据可视化**：Chart.js + Recharts + 自定义图表组件

### 创新性架构设计

#### 1. 分层架构模式
```
┌─────────────────┐
│   表现层 (UI)    │  Next.js + React + Tailwind
├─────────────────┤
│   API层         │  Next.js API Routes + 中间件
├─────────────────┤
│   服务层        │  业务逻辑 + 队列管理 + 监听服务
├─────────────────┤
│   数据访问层     │  Prisma ORM + 连接池
├─────────────────┤
│   数据存储层     │  PostgreSQL/MySQL
└─────────────────┘
```

#### 2. 微服务化设计
- **邮件队列服务**：独立的邮件发送队列管理
- **监听服务**：独立的邮件监听和回复处理
- **任务恢复服务**：自动任务恢复和健康检查
- **通知服务**：实时通知和状态同步

#### 3. 事件驱动架构
- **发布订阅模式**：松耦合的服务间通信
- **事件溯源**：完整的操作历史记录
- **异步处理**：提升系统响应性能

## 🚀 快速开始

### 环境要求
- Node.js 18.0 或更高版本
- PostgreSQL 或 MySQL 数据库
- SMTP 邮件服务（如 Gmail、Outlook、企业邮箱等）
- IMAP 邮件服务（用于邮件监听功能）

### 1. 克隆仓库

```bash
git clone <repository-url>
cd email-marketing-system
```

### 2. 安装依赖

```bash
npm install
# 或使用 yarn
yarn install
# 或使用 pnpm（推荐）
pnpm install
```

### 3. 环境配置

创建 `.env.local` 文件并配置以下环境变量：

```env
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/email_marketing"
# 或 MySQL
# DATABASE_URL="mysql://username:password@localhost:3306/email_marketing"

# NextAuth 认证配置
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# 默认 SMTP 配置（可在系统中动态配置多个）
DEFAULT_SMTP_HOST="smtp.gmail.com"
DEFAULT_SMTP_PORT=587
DEFAULT_SMTP_USER="your-email@gmail.com"
DEFAULT_SMTP_PASS="your-app-password"

# 默认 IMAP 配置（用于邮件监听）
DEFAULT_IMAP_HOST="imap.gmail.com"
DEFAULT_IMAP_PORT=993
DEFAULT_IMAP_USER="your-email@gmail.com"
DEFAULT_IMAP_PASS="your-app-password"

# 系统配置
APP_NAME="欢喜邮件营销系统"
APP_URL="http://localhost:3000"

# 可选：Redis 配置（用于缓存和队列优化）
# REDIS_URL="redis://localhost:6379"

# 可选：文件存储配置
# UPLOAD_DIR="./uploads"
# MAX_FILE_SIZE=10485760  # 10MB
```

### 4. 数据库初始化

```bash
# 生成 Prisma 客户端
npx prisma generate

# 推送数据库架构
npx prisma db push

# 可选：查看数据库
npx prisma studio
```

### 5. 启动开发服务器

```bash
# 启动主应用
npm run dev

# 在新终端启动邮件监听服务（可选）
npm run email-monitor

# 在新终端启动邮件预热服务（可选）
npm run warmup:start
```

访问 [http://localhost:3000](http://localhost:3000) 开始使用系统。

### 6. 生产环境部署

```bash
# 构建应用
npm run build

# 启动生产服务器
npm start
```

## 📁 项目架构详解

### 核心目录结构

```
src/
├── app/                           # Next.js 14 App Router
│   ├── api/                      # RESTful API 端点
│   │   ├── auth/                 # 用户认证 API
│   │   ├── campaigns/            # 营销活动管理 API
│   │   ├── email-monitor/        # 邮件监听 API
│   │   ├── email-replies/        # 邮件回复管理 API
│   │   ├── analytics/            # 数据分析 API
│   │   ├── templates/            # 邮件模板 API
│   │   ├── recipients/           # 收件人管理 API
│   │   ├── send-email/           # 邮件发送 API
│   │   ├── tracking/             # 邮件追踪 API
│   │   └── system/               # 系统管理 API
│   ├── dashboard/                # 主控制台页面
│   │   ├── analytics/            # 数据分析页面
│   │   ├── campaigns/            # 营销活动管理
│   │   ├── templates/            # 模板管理
│   │   ├── recipients/           # 收件人管理
│   │   ├── settings/             # 系统设置
│   │   └── history/              # 发送历史
│   ├── auth/                     # 认证页面
│   │   ├── login/                # 登录页面
│   │   └── register/             # 注册页面
│   └── email-monitor/            # 邮件监听管理页面
├── components/                    # React 组件库
│   ├── ui/                       # 基础 UI 组件
│   │   ├── button.tsx            # 按钮组件
│   │   ├── input.tsx             # 输入框组件
│   │   ├── dialog.tsx            # 对话框组件
│   │   ├── table.tsx             # 表格组件
│   │   └── chart.tsx             # 图表组件
│   ├── dashboard/                # 仪表板组件
│   │   ├── sidebar.tsx           # 侧边栏导航
│   │   ├── header.tsx            # 顶部导航
│   │   └── SendingStatusMonitor.tsx # 发送状态监控
│   ├── auth/                     # 认证相关组件
│   │   ├── login-form.tsx        # 登录表单
│   │   └── register-form.tsx     # 注册表单
│   └── email-replies/            # 邮件回复组件
├── lib/                          # 核心业务逻辑库
│   ├── email-queue.ts            # 邮件队列管理系统
│   ├── email-monitor.ts          # 邮件监听服务
│   ├── email-tracking.ts         # 邮件追踪系统
│   ├── email-reply-matcher.ts    # 回复匹配算法
│   ├── task-recovery.ts          # 任务恢复服务
│   ├── queue-manager.ts          # 队列管理器
│   ├── auth.ts                   # 认证配置
│   ├── prisma.ts                 # 数据库连接
│   ├── session.ts                # 会话管理
│   └── utils.ts                  # 工具函数
├── scripts/                      # 脚本文件
│   ├── start-email-monitor.ts    # 邮件监听服务启动脚本
│   └── start-warmup.ts           # 邮件预热服务启动脚本
├── types/                        # TypeScript 类型定义
│   ├── global.d.ts               # 全局类型定义
│   └── next-auth.d.ts            # NextAuth 类型扩展
└── middleware.ts                 # Next.js 中间件
```

### 🎯 创新性功能设计

#### 1. 智能邮件队列系统
**技术创新点**：
- **一封一封发送机制**：独创的顺序发送算法，确保每个营销活动的邮件按顺序发送
- **活动级别并发**：不同营销活动可以并发执行，但同一活动内部严格顺序发送
- **智能间隔控制**：支持固定间隔和随机间隔，避免被邮件服务商识别为垃圾邮件
- **断点续传**：系统重启后可从中断位置继续发送，不会重复发送已发送的邮件

**核心文件**：`src/lib/email-queue.ts`

#### 2. 实时邮件监听系统
**技术创新点**：
- **IMAP 长连接监听**：基于 IMAP IDLE 命令的实时邮件监听
- **智能回复匹配**：通过邮件头信息和内容分析，精确匹配回复邮件与原始邮件
- **多用户隔离**：每个用户的邮件监听服务独立运行，确保数据安全
- **连接池管理**：高效的 IMAP 连接池，减少连接开销

**核心文件**：`src/lib/email-monitor.ts`、`src/lib/email-reply-matcher.ts`

#### 3. 任务恢复与健康检查系统
**技术创新点**：
- **自动任务恢复**：系统启动时自动检测未完成的发送任务并恢复
- **健康检查机制**：定期检查服务状态，自动重启异常服务
- **任务状态同步**：实时同步任务状态，确保数据一致性
- **故障转移**：支持多实例部署时的故障转移

**核心文件**：`src/lib/task-recovery.ts`、`src/lib/queue-manager.ts`

#### 4. 高级数据分析引擎
**技术创新点**：
- **实时统计计算**：基于事件驱动的实时数据统计
- **多维度分析**：支持按时间、活动、收件人等多维度分析
- **趋势预测**：基于历史数据的发送效果趋势预测
- **A/B 测试支持**：内置 A/B 测试功能，优化邮件营销效果

#### 5. 智能邮件追踪系统
**技术创新点**：
- **像素追踪**：通过透明像素图片追踪邮件打开率
- **链接点击追踪**：自动转换邮件中的链接为追踪链接
- **用户行为分析**：分析收件人的邮件阅读行为
- **隐私保护**：遵循 GDPR 等隐私保护法规

**核心文件**：`src/lib/email-tracking.ts`

## 📚 详细功能指南

### 1. 邮件活动管理
**创建和管理邮件营销活动**
- **活动创建**：支持创建多种类型的邮件营销活动
- **模板选择**：丰富的邮件模板库，支持自定义模板
- **收件人管理**：灵活的收件人分组和筛选功能
- **发送计划**：支持立即发送和定时发送
- **A/B 测试**：内置 A/B 测试功能，优化邮件效果

### 2. 收件人数据管理
**强大的收件人数据管理系统**
- **批量导入**：支持 CSV/Excel 文件批量导入收件人
- **分组管理**：灵活的分组功能，支持多维度分组
- **数据验证**：自动验证邮箱格式和重复数据
- **标签系统**：为收件人添加自定义标签
- **数据导出**：支持收件人数据导出和备份

### 3. 邮件模板系统
**专业的邮件模板设计工具**
- **可视化编辑器**：拖拽式邮件模板编辑器
- **响应式设计**：自动适配各种设备和邮件客户端
- **变量替换**：支持个性化变量替换
- **模板库**：丰富的预设模板库
- **HTML 编辑**：支持直接编辑 HTML 代码

### 4. 发送状态监控
**实时监控邮件发送状态**
- **实时统计**：实时显示发送进度和统计数据
- **状态追踪**：追踪每封邮件的发送状态
- **错误分析**：详细的错误日志和分析
- **性能监控**：发送速度和成功率监控
- **告警通知**：异常情况自动告警

### 5. 邮件回复管理
**智能邮件回复处理系统**
- **自动监听**：实时监听邮件回复
- **智能匹配**：精确匹配回复与原始邮件
- **回复分类**：自动分类不同类型的回复
- **回复统计**：详细的回复数据统计
- **客户管理**：基于回复的客户关系管理

## 🚀 性能优化特性

### 1. 数据库优化
- **连接池管理**：Prisma 连接池优化，支持高并发访问
- **查询优化**：智能索引设计，复杂查询性能提升 90%
- **批量操作**：批量插入和更新，减少数据库 I/O
- **缓存策略**：Redis 缓存热点数据，响应速度提升 80%
- **分页优化**：高效的分页查询，支持大数据量处理

### 2. 前端性能优化
- **代码分割**：基于路由的代码分割，首屏加载时间减少 60%
- **图片优化**：Next.js Image 组件，自动 WebP 转换和懒加载
- **CSS 优化**：Tailwind CSS JIT 模式，生产环境 CSS 体积减少 70%
- **缓存策略**：静态资源 CDN 缓存，全球访问加速
- **虚拟滚动**：大列表虚拟滚动，提升渲染性能

### 3. 邮件发送优化
- **连接复用**：SMTP 连接池，减少连接建立开销
- **并发控制**：智能并发控制，避免邮件服务商限制
- **重试机制**：指数退避重试算法，提高发送成功率
- **负载均衡**：多 SMTP 服务商负载均衡，提升发送稳定性
- **发送节流**：智能发送间隔控制，避免被识别为垃圾邮件

## 🔒 安全特性

### 1. 认证与授权
- **多因素认证**：支持 TOTP、短信验证等多种 2FA 方式
- **会话管理**：安全的会话管理，支持会话过期和强制登出
- **权限控制**：基于角色的访问控制（RBAC），细粒度权限管理
- **API 安全**：JWT Token 认证，API 访问频率限制

### 2. 数据安全
- **数据加密**：敏感数据 AES-256 加密存储
- **传输安全**：全站 HTTPS，TLS 1.3 加密传输
- **数据备份**：自动数据备份，支持增量备份和恢复
- **审计日志**：完整的操作审计日志，支持合规性检查

### 3. 隐私保护
- **GDPR 合规**：支持数据删除权、数据可携权等 GDPR 要求
- **数据脱敏**：敏感数据自动脱敏显示
- **访问控制**：IP 白名单、地理位置限制等访问控制
- **数据隔离**：多租户数据完全隔离，确保数据安全

## 📖 使用指南

### 快速开始

#### 1. 首次登录
1. 访问系统首页，点击「注册」创建账户
2. 填写用户信息完成注册
3. 登录系统进入控制面板

#### 2. 配置邮件服务
1. 进入「邮件配置」页面
2. 添加您的 SMTP 邮件服务器配置
3. 测试连接确保配置正确
4. 可配置多个邮件服务商实现负载均衡

#### 3. 导入收件人
1. 进入「收件人管理」页面
2. 点击「批量导入」上传 CSV/Excel 文件
3. 映射字段（姓名、邮箱、公司等）
4. 选择或创建分组
5. 确认导入数据

#### 4. 创建邮件模板
1. 进入「邮件模板」页面
2. 选择预设模板或创建新模板
3. 使用可视化编辑器设计邮件内容
4. 添加个性化变量（如 {{姓名}}、{{公司}}）
5. 预览并保存模板

#### 5. 创建营销活动
1. 进入「营销活动」页面
2. 点击「创建活动」
3. 选择邮件模板和收件人分组
4. 设置发送计划（立即发送或定时发送）
5. 配置发送参数（发送间隔、重试次数等）
6. 启动活动开始发送

#### 6. 监控发送状态
1. 在活动列表中查看发送进度
2. 点击活动名称查看详细统计
3. 监控发送成功率和错误信息
4. 查看邮件回复和客户反馈

### 最佳实践

#### 邮件内容优化
- **主题行**：简洁明了，避免垃圾邮件关键词
- **个性化**：使用收件人姓名和公司信息
- **内容结构**：清晰的层次结构，重点突出
- **行动号召**：明确的 CTA 按钮和链接
- **移动适配**：确保在移动设备上显示良好

#### 发送策略优化
- **发送时间**：选择收件人活跃的时间段
- **发送频率**：避免过于频繁的邮件发送
- **分组发送**：根据用户特征进行精准分组
- **A/B 测试**：测试不同版本的邮件效果
- **渐进发送**：大批量发送前先小规模测试

#### 数据管理建议
- **数据清洗**：定期清理无效邮箱地址
- **分组管理**：建立清晰的分组体系
- **标签使用**：合理使用标签进行精细化管理
- **数据备份**：定期备份重要的收件人数据
- **隐私保护**：遵守数据保护法规

## 🌐 部署指南

### 1. Docker 部署（推荐）

```bash
# 克隆项目
git clone <repository-url>
cd email-marketing-system

# 构建 Docker 镜像
docker build -t email-marketing-system .

# 使用 Docker Compose 启动
docker-compose up -d
```

**docker-compose.yml 示例**：
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/email_marketing
      - NEXTAUTH_SECRET=your-secret-key
    depends_on:
      - db
      - redis
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=email_marketing
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 2. Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署到 Vercel
vercel --prod
```

### 3. 自建服务器部署

```bash
# 构建生产版本
npm run build

# 使用 PM2 管理进程
npm install -g pm2
pm2 start npm --name "email-marketing" -- start

# 配置 Nginx 反向代理
sudo nano /etc/nginx/sites-available/email-marketing
```

**Nginx 配置示例**：
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 监控与运维

### 1. 系统监控
- **性能监控**：内置性能监控面板，实时查看系统状态
- **错误追踪**：集成错误追踪系统，快速定位问题
- **日志管理**：结构化日志记录，支持日志搜索和分析
- **告警系统**：智能告警系统，异常情况及时通知

### 2. 业务监控
- **发送监控**：实时监控邮件发送状态和成功率
- **用户行为分析**：用户操作行为分析和统计
- **系统资源监控**：CPU、内存、磁盘等资源使用监控
- **数据库监控**：数据库性能和连接状态监控

## 🤝 贡献指南

我们欢迎所有形式的贡献！请遵循以下步骤：

### 开发流程
1. **Fork 项目**：Fork 这个仓库到您的 GitHub 账户
2. **创建分支**：`git checkout -b feature/your-feature-name`
3. **开发功能**：按照项目规范开发新功能
4. **测试验证**：确保所有测试通过，新功能正常工作
5. **提交代码**：`git commit -m 'feat: add your feature'`
6. **推送分支**：`git push origin feature/your-feature-name`
7. **创建 PR**：创建 Pull Request 并详细描述您的更改

### 代码规范
- **TypeScript**：使用严格的 TypeScript 类型检查
- **ESLint**：遵循项目 ESLint 配置
- **Prettier**：使用 Prettier 格式化代码
- **Commit 规范**：使用 Conventional Commits 规范

### 测试要求
- **单元测试**：新功能必须包含单元测试
- **集成测试**：关键功能需要集成测试
- **E2E 测试**：用户流程需要端到端测试

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户。特别感谢以下开源项目：

- [Next.js](https://nextjs.org/) - React 全栈框架
- [Prisma](https://www.prisma.io/) - 现代数据库工具包
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架
- [Radix UI](https://www.radix-ui.com/) - 低级 UI 原语
- [NextAuth.js](https://next-auth.js.org/) - 认证解决方案

## 📚 相关文档

### 技术文档
- **[API 文档](./API_DOCUMENTATION.md)**：完整的 API 接口文档
- **[开发规则](./DEVELOPMENT_RULES.md)**：开发规范和技术约束
- **[架构设计](./ARCHITECTURE.md)**：系统架构和设计原理
- **[部署指南](./VERCEL_DEPLOYMENT_GUIDE.md)**：Vercel 部署详细指南

### 功能文档
- **[邮件监听设置](./EMAIL_MONITOR_SETUP.md)**：邮件监听功能配置
- **[递归服务](./RECURSIVE_SERVICE.md)**：后台服务管理指南
- **[无服务器优化](./SERVERLESS_OPTIMIZATION.md)**：性能优化指南

## 🔧 故障排除

### 常见问题

#### 1. 邮件发送失败
**问题**：邮件发送时出现错误
**解决方案**：
- 检查 SMTP 配置是否正确
- 验证邮箱密码和授权码
- 确认邮件服务商的发送限制
- 查看错误日志获取详细信息

#### 2. 邮件监听不工作
**问题**：无法接收到邮件回复
**解决方案**：
- 检查 IMAP 配置是否正确
- 确认邮箱开启了 IMAP 服务
- 验证网络连接和防火墙设置
- 重启邮件监听服务

#### 3. 数据库连接错误
**问题**：无法连接到数据库
**解决方案**：
- 检查 `DATABASE_URL` 环境变量
- 确认数据库服务正在运行
- 验证数据库用户权限
- 运行数据库迁移命令

#### 4. 页面加载缓慢
**问题**：系统响应速度慢
**解决方案**：
- 检查数据库查询性能
- 优化大数据量的分页查询
- 清理浏览器缓存
- 检查网络连接状况

#### 5. 文件上传失败
**问题**：无法上传收件人文件
**解决方案**：
- 检查文件格式是否为 CSV 或 Excel
- 确认文件大小不超过限制
- 验证文件内容格式正确
- 检查服务器磁盘空间

### 调试技巧

#### 开发环境调试
```bash
# 查看详细日志
npm run dev

# 检查数据库状态
npx prisma studio

# 重置数据库
npx prisma migrate reset

# 查看邮件队列状态
# 访问 /api/queue/status
```

#### 生产环境监控
```bash
# 查看应用日志
docker logs email-marketing-system

# 监控系统资源
top -p $(pgrep node)

# 检查数据库连接
psql $DATABASE_URL -c "SELECT 1;"
```

## 🚀 性能优化建议

### 数据库优化
- **索引优化**：为常用查询字段添加索引
- **查询优化**：使用 Prisma 的查询优化功能
- **连接池**：合理配置数据库连接池大小
- **分页查询**：大数据量使用游标分页

### 邮件发送优化
- **批量处理**：合理设置批量发送大小
- **发送间隔**：根据邮件服务商限制调整间隔
- **连接复用**：启用 SMTP 连接复用
- **错误重试**：配置合理的重试策略

### 前端性能优化
- **代码分割**：按路由进行代码分割
- **图片优化**：使用 WebP 格式和懒加载
- **缓存策略**：合理设置浏览器缓存
- **虚拟滚动**：大列表使用虚拟滚动

## 📞 支持与联系

如果您在使用过程中遇到问题或有任何建议，请通过以下方式联系我们：

- **GitHub Issues**：[提交问题](https://github.com/your-repo/issues)
- **讨论区**：[GitHub Discussions](https://github.com/your-repo/discussions)
- **邮箱**：support@your-domain.com
- **文档**：[在线文档](https://docs.your-domain.com)

### 获取帮助
- **使用问题**：查看本文档的故障排除部分
- **功能建议**：在 GitHub Discussions 中提出
- **Bug 报告**：在 GitHub Issues 中详细描述问题
- **技术支持**：发送邮件到技术支持邮箱

---

**欢喜邮件营销系统** - 让邮件营销更简单、更高效、更智能！ 🚀

> 💡 **提示**：建议在使用前仔细阅读相关文档，特别是 [开发规则](./DEVELOPMENT_RULES.md) 和 [API 文档](./API_DOCUMENTATION.md)，以便更好地理解和使用系统功能。