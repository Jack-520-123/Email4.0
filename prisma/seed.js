"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
// 加密函数
function encrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8');
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipher(algorithm, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}
async function main() {
    console.log('开始初始化数据库...');
    // 创建系统管理员账号
    const adminEmail = 'admin@admin.com';
    const adminPassword = 'admin123';
    const hashedPassword = await bcryptjs_1.default.hash(adminPassword, 12);
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            name: '系统管理员',
            password: hashedPassword,
            role: 'admin',
            permissions: {
                emailTypes: ['qq', '163', 'gmail', 'outlook'],
                maxCampaigns: 999,
                canManageUsers: true,
                canManageSystem: true
            }
        }
    });
    console.log('系统管理员账号创建成功:', admin.email);
    // 创建QQ邮箱配置
    const qqEmailConfig = {
        nickname: 'QQ邮箱默认配置',
        email: 'jack6283@foxmail.com',
        password: 'kxxblhramwkibbji', // 授权码
        emailType: 'qq',
        smtpServer: 'smtp.qq.com',
        smtpPort: 587,
        isDefault: true,
        isSystemAdmin: true,
        userId: admin.id
    };
    // 加密密码
    const encryptedPassword = encrypt(qqEmailConfig.password);
    // 先检查是否已存在相同的邮箱配置
    const existingProfile = await prisma.emailProfile.findFirst({
        where: {
            email: qqEmailConfig.email,
            userId: admin.id
        }
    });
    let emailProfile;
    if (existingProfile) {
        emailProfile = await prisma.emailProfile.update({
            where: { id: existingProfile.id },
            data: {
                password: encryptedPassword,
                isDefault: true,
                isSystemAdmin: true
            }
        });
    }
    else {
        emailProfile = await prisma.emailProfile.create({
            data: {
                ...qqEmailConfig,
                password: encryptedPassword
            }
        });
    }
    console.log('QQ邮箱配置创建成功:', emailProfile.email);
    console.log('数据库初始化完成！');
    console.log('管理员登录信息:');
    console.log('邮箱:', adminEmail);
    console.log('密码:', adminPassword);
}
main()
    .catch((e) => {
    console.error('数据库初始化失败:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
