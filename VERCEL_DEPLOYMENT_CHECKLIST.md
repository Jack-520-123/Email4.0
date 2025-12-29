# Vercel 部署检查清单

## 🎉 构建问题已修复

### 修复的问题
1. **TypeScript 错误**: 修复了 `EmailMonitorManager` 中 `stopAll()` 和 `startAll()` 方法不存在的问题
   - 将 `stopAll()` 改为 `stopMonitoring()`
   - 将 `startAll()` 改为 `startMonitoring()`

2. **JSX 语法错误**: 修复了 debug 页面中的 `>` 符号问题
   - 将 `>` 改为 `&gt;`

3. **构建验证**: 项目现在可以成功构建 ✅

## 📋 Vercel 部署步骤

### 1. 环境变量配置
在 Vercel 项目设置中添加以下环境变量：

```bash
# 必需的环境变量
DATABASE_URL="postgresql://username:password@host:port/database"
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="your-nextauth-secret-key"

# 可选的邮件监听配置（如果需要邮件回复功能）
IMAP_HOST="imap.gmail.com"
IMAP_PORT=993
IMAP_USER="your-email@gmail.com"
IMAP_PASS="your-app-password"

# 跳过环境变量验证（已在 vercel.json 中配置）
SKIP_ENV_VALIDATION="1"
```

### 2. 数据库设置

#### 选项 A: 使用 Vercel Postgres（推荐）
1. 在 Vercel 项目中添加 Postgres 存储
2. 复制提供的 `DATABASE_URL`
3. 在环境变量中设置

#### 选项 B: 使用外部 PostgreSQL
1. 准备 PostgreSQL 数据库
2. 确保数据库可从外网访问
3. 配置正确的 `DATABASE_URL`

### 3. 部署配置验证

#### vercel.json 配置 ✅
```json
{
  "buildCommand": "npm run build",
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "env": {
    "SKIP_ENV_VALIDATION": "1"
  },
  "installCommand": "npm install"
}
```

#### next.config.js 配置 ✅
- 外部包配置正确
- Standalone 输出模式
- SWC 压缩启用

#### package.json 构建脚本 ✅
```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

### 4. 部署后设置

1. **数据库迁移**
   ```bash
   # 在 Vercel 项目设置的 Functions 标签页中运行
   npx prisma db push
   ```

2. **验证部署**
   - 访问首页确认应用正常运行
   - 测试登录功能
   - 检查数据库连接

3. **功能测试**
   - 创建测试用户
   - 配置邮件发送设置
   - 测试基本的邮件发送功能

### 5. 常见问题解决

#### 构建失败
- ✅ TypeScript 错误已修复
- ✅ JSX 语法错误已修复
- 检查环境变量是否正确设置

#### 数据库连接问题
- 验证 `DATABASE_URL` 格式正确
- 确保数据库服务可访问
- 检查防火墙和网络设置

#### 运行时错误
- 检查 Vercel 函数日志
- 验证所有必需的环境变量
- 确保 Prisma 客户端正确生成

### 6. 性能优化建议

1. **函数超时设置**: 已配置为 60 秒
2. **外部包优化**: 已配置 nodemailer, imap, mailparser
3. **构建优化**: 使用 SWC 压缩和 standalone 输出

### 7. 监控和维护

1. **日志监控**: 使用 Vercel 控制台查看函数日志
2. **性能监控**: 监控函数执行时间和内存使用
3. **错误追踪**: 设置适当的错误处理和日志记录

## 🚀 部署命令

如果使用 Vercel CLI：
```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 部署
vercel --prod
```

## ✅ 部署成功标志

- [ ] 构建成功完成
- [ ] 应用可以正常访问
- [ ] 登录功能正常
- [ ] 数据库连接正常
- [ ] 基本功能测试通过

---

**注意**: 如果遇到任何问题，请检查 Vercel 控制台的构建日志和函数日志以获取详细的错误信息。