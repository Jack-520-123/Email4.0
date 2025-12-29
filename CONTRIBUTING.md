# 贡献指南

欢迎为欢喜邮件营销系统做出贡献！我们非常感谢您的参与和支持。

## 🎯 贡献原则

### 核心原则
1. **稳定性第一**：确保不破坏现有功能
2. **向后兼容**：新功能必须与现有功能兼容
3. **代码质量**：遵循项目的代码规范和最佳实践
4. **文档完善**：代码修改必须同步更新相关文档

### 贡献类型
- 🐛 **Bug 修复**：修复系统中的错误和问题
- ✨ **新功能**：添加新的功能和特性
- 📚 **文档改进**：完善文档和使用指南
- 🎨 **UI/UX 改进**：优化用户界面和体验
- ⚡ **性能优化**：提升系统性能和效率
- 🔒 **安全增强**：加强系统安全性

## 🚀 开始贡献

### 1. 准备工作

#### Fork 项目
1. 访问项目的 GitHub 仓库
2. 点击右上角的 "Fork" 按钮
3. 将项目 Fork 到您的 GitHub 账户

#### 克隆代码
```bash
# 克隆您 Fork 的仓库
git clone https://github.com/YOUR_USERNAME/email-marketing-system.git
cd email-marketing-system

# 添加上游仓库
git remote add upstream https://github.com/ORIGINAL_OWNER/email-marketing-system.git
```

#### 环境设置
```bash
# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env.local

# 配置数据库
npx prisma migrate dev

# 启动开发服务器
npm run dev
```

### 2. 开发流程

#### 创建功能分支
```bash
# 确保主分支是最新的
git checkout main
git pull upstream main

# 创建新的功能分支
git checkout -b feature/your-feature-name
# 或者修复分支
git checkout -b fix/your-bug-fix
```

#### 开发规范

**分支命名规范**：
- `feature/功能名称` - 新功能开发
- `fix/问题描述` - Bug 修复
- `docs/文档类型` - 文档更新
- `style/样式描述` - 样式调整
- `refactor/重构描述` - 代码重构
- `perf/性能优化` - 性能优化

**代码规范**：
- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 配置
- 添加适当的注释和文档
- 编写单元测试（如适用）

### 3. 提交代码

#### 提交信息规范
使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**类型说明**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例**：
```bash
git commit -m "feat(email): add email template validation"
git commit -m "fix(queue): resolve memory leak in email queue"
git commit -m "docs(readme): update installation instructions"
```

#### 推送代码
```bash
# 推送到您的 Fork 仓库
git push origin feature/your-feature-name
```

### 4. 创建 Pull Request

1. 访问您 Fork 的仓库页面
2. 点击 "Compare & pull request" 按钮
3. 填写 PR 标题和描述
4. 确保通过所有检查
5. 等待代码审查

#### PR 模板
```markdown
## 变更类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 文档更新
- [ ] 性能优化
- [ ] 其他

## 变更描述
简要描述您的更改内容和原因。

## 测试
- [ ] 已添加单元测试
- [ ] 已进行手动测试
- [ ] 所有现有测试通过

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 已更新相关文档
- [ ] 不会破坏现有功能
- [ ] 已测试在不同环境下的兼容性

## 相关问题
关闭 #issue_number
```

## 📋 开发指南

### 代码质量要求

#### TypeScript 规范
```typescript
// ✅ 好的示例
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

const sendEmail = async (config: EmailConfig): Promise<void> => {
  // 实现逻辑
};

// ❌ 避免的写法
const sendEmail = async (config: any) => {
  // 避免使用 any 类型
};
```

#### 错误处理
```typescript
// ✅ 完善的错误处理
try {
  const result = await emailService.send(emailData);
  logger.info('Email sent successfully', { messageId: result.messageId });
  return { success: true, messageId: result.messageId };
} catch (error) {
  logger.error('Email sending failed', { 
    error: error.message,
    emailData: { to: emailData.to, subject: emailData.subject }
  });
  throw new EmailSendError('Failed to send email', error);
}
```

#### 组件规范
```tsx
// ✅ React 组件最佳实践
interface EmailTemplateProps {
  template: EmailTemplate;
  onSave: (template: EmailTemplate) => void;
  isLoading?: boolean;
}

const EmailTemplateEditor: React.FC<EmailTemplateProps> = ({
  template,
  onSave,
  isLoading = false
}) => {
  // 组件实现
};

export default EmailTemplateEditor;
```

### 测试要求

#### 单元测试
```typescript
// 测试文件：__tests__/email-service.test.ts
import { EmailService } from '../src/lib/email-service';

describe('EmailService', () => {
  it('should send email successfully', async () => {
    const emailService = new EmailService(mockConfig);
    const result = await emailService.send(mockEmailData);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  it('should handle send failure gracefully', async () => {
    const emailService = new EmailService(invalidConfig);
    
    await expect(emailService.send(mockEmailData))
      .rejects.toThrow('Failed to send email');
  });
});
```

#### 集成测试
```typescript
// 测试 API 端点
import { createMocks } from 'node-mocks-http';
import handler from '../src/pages/api/campaigns';

describe('/api/campaigns', () => {
  it('should create campaign successfully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: mockCampaignData,
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
    expect(JSON.parse(res._getData())).toMatchObject({
      success: true,
      campaign: expect.objectContaining({
        id: expect.any(String),
        name: mockCampaignData.name,
      }),
    });
  });
});
```

### 性能考虑

#### 数据库查询优化
```typescript
// ✅ 优化的查询
const campaigns = await prisma.campaign.findMany({
  where: { userId },
  select: {
    id: true,
    name: true,
    status: true,
    createdAt: true,
    _count: {
      select: { emails: true }
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 20,
  skip: page * 20,
});

// ❌ 避免的查询
const campaigns = await prisma.campaign.findMany({
  where: { userId },
  include: {
    emails: true, // 避免加载大量关联数据
    template: true,
    recipients: true,
  },
});
```

#### 前端性能优化
```tsx
// ✅ 使用 React.memo 和 useMemo
const EmailList = React.memo<EmailListProps>(({ emails, onSelect }) => {
  const sortedEmails = useMemo(() => 
    emails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [emails]
  );

  return (
    <div>
      {sortedEmails.map(email => (
        <EmailItem key={email.id} email={email} onSelect={onSelect} />
      ))}
    </div>
  );
});
```

## 🔍 代码审查

### 审查清单

#### 功能性
- [ ] 代码实现了预期功能
- [ ] 边界情况得到适当处理
- [ ] 错误处理完善
- [ ] 性能影响可接受

#### 代码质量
- [ ] 代码结构清晰
- [ ] 命名规范一致
- [ ] 注释适当且有用
- [ ] 无重复代码

#### 安全性
- [ ] 输入验证充分
- [ ] 无安全漏洞
- [ ] 敏感信息得到保护
- [ ] 权限控制正确

#### 兼容性
- [ ] 向后兼容
- [ ] 跨浏览器兼容
- [ ] 移动设备友好
- [ ] 无破坏性变更

### 审查反馈

#### 提供建设性反馈
```markdown
# ✅ 好的反馈
建议在第45行添加输入验证，确保邮箱格式正确：
```typescript
if (!isValidEmail(email)) {
  throw new ValidationError('Invalid email format');
}
```

# ❌ 避免的反馈
这里有问题。
```

## 🐛 Bug 报告

### 报告模板
```markdown
## Bug 描述
简要描述遇到的问题。

## 复现步骤
1. 进入 '...'
2. 点击 '....'
3. 滚动到 '....'
4. 看到错误

## 期望行为
描述您期望发生的情况。

## 实际行为
描述实际发生的情况。

## 截图
如果适用，添加截图来帮助解释您的问题。

## 环境信息
- 操作系统: [例如 Windows 10]
- 浏览器: [例如 Chrome 91.0]
- Node.js 版本: [例如 16.14.0]
- 项目版本: [例如 1.2.3]

## 附加信息
添加任何其他相关信息。
```

## 💡 功能建议

### 建议模板
```markdown
## 功能描述
简要描述您希望添加的功能。

## 问题背景
描述这个功能要解决的问题。

## 解决方案
描述您希望的解决方案。

## 替代方案
描述您考虑过的其他解决方案。

## 附加信息
添加任何其他相关信息或截图。
```

## 📞 获取帮助

如果您在贡献过程中遇到问题，可以通过以下方式获取帮助：

- **GitHub Discussions**：提出问题和讨论
- **GitHub Issues**：报告 Bug 或提出功能建议
- **邮件联系**：发送邮件到 contributors@your-domain.com
- **文档查阅**：查看 [开发规则](./DEVELOPMENT_RULES.md) 和 [API 文档](./API_DOCUMENTATION.md)

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！您的贡献让这个项目变得更好。

### 贡献者列表
<!-- 这里会自动生成贡献者列表 -->

---

**再次感谢您的贡献！** 🎉