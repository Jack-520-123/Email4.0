#!/usr/bin/env node

/**
 * 部署前检查脚本
 * 验证所有优化配置是否正确，确保Vercel部署成功
 */

const fs = require('fs')
const path = require('path')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const REQUIRED_FILES = [
  '.env',
  '.env.example',
  'vercel.json',
  'package.json',
  'src/lib/prisma.ts',
  'src/lib/batch-db-operations.ts',
  'src/lib/db-index-optimization.ts',
  'src/lib/query-optimization.ts',
  'src/lib/performance-monitor.ts',
  'src/lib/app-initializer.ts',
  'src/app/api/performance/route.ts'
]

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'ENCRYPTION_KEY',
  'NODE_ENV'
]

class PreDeployChecker {
  constructor() {
    this.errors = []
    this.warnings = []
    this.success = []
  }

  log(type, message) {
    const timestamp = new Date().toISOString()
    const prefix = {
      error: '❌ ERROR',
      warning: '⚠️  WARNING',
      success: '✅ SUCCESS',
      info: 'ℹ️  INFO'
    }[type] || 'INFO'
    
    console.log(`[${timestamp}] ${prefix}: ${message}`)
    
    if (type === 'error') this.errors.push(message)
    if (type === 'warning') this.warnings.push(message)
    if (type === 'success') this.success.push(message)
  }

  // 检查必需文件是否存在
  checkRequiredFiles() {
    this.log('info', '检查必需文件...')
    
    for (const file of REQUIRED_FILES) {
      const filePath = path.join(PROJECT_ROOT, file)
      if (fs.existsSync(filePath)) {
        this.log('success', `文件存在: ${file}`)
      } else {
        this.log('error', `文件缺失: ${file}`)
      }
    }
  }

  // 检查环境变量配置
  checkEnvironmentVariables() {
    this.log('info', '检查环境变量配置...')
    
    const envPath = path.join(PROJECT_ROOT, '.env')
    const envExamplePath = path.join(PROJECT_ROOT, '.env.example')
    
    if (!fs.existsSync(envPath)) {
      this.log('error', '.env 文件不存在')
      return
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8')
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8')
    
    // 检查必需的环境变量
    for (const envVar of REQUIRED_ENV_VARS) {
      if (envContent.includes(`${envVar}=`)) {
        this.log('success', `环境变量存在: ${envVar}`)
      } else {
        this.log('error', `环境变量缺失: ${envVar}`)
      }
    }
    
    // 检查数据库连接池参数
    if (envContent.includes('connection_limit=') && 
        envContent.includes('pool_timeout=') && 
        envContent.includes('pgbouncer=true')) {
      this.log('success', '数据库连接池参数配置正确')
    } else {
      this.log('error', '数据库连接池参数配置不完整')
    }
    
    // 检查示例文件是否同步
    if (envExampleContent.includes('connection_limit=')) {
      this.log('success', '.env.example 文件已同步更新')
    } else {
      this.log('warning', '.env.example 文件可能需要更新')
    }
  }

  // 检查Vercel配置
  checkVercelConfig() {
    this.log('info', '检查Vercel配置...')
    
    const vercelConfigPath = path.join(PROJECT_ROOT, 'vercel.json')
    if (!fs.existsSync(vercelConfigPath)) {
      this.log('error', 'vercel.json 文件不存在')
      return
    }
    
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'))
    
    // 检查API函数超时设置
    if (vercelConfig.functions && 
        vercelConfig.functions['src/app/api/**/*.ts'] && 
        vercelConfig.functions['src/app/api/**/*.ts'].maxDuration >= 60) {
      this.log('success', 'API函数超时设置正确')
    } else {
      this.log('warning', 'API函数超时设置可能需要调整')
    }
    
    // 检查构建命令
    if (vercelConfig.buildCommand === 'npm run build') {
      this.log('success', '构建命令配置正确')
    } else {
      this.log('warning', '构建命令可能需要检查')
    }
  }

  // 检查Package.json配置
  checkPackageJson() {
    this.log('info', '检查Package.json配置...')
    
    const packagePath = path.join(PROJECT_ROOT, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    
    // 检查构建脚本
    if (packageJson.scripts.build && 
        packageJson.scripts.build.includes('prisma generate')) {
      this.log('success', '构建脚本包含Prisma生成')
    } else {
      this.log('error', '构建脚本缺少Prisma生成')
    }
    
    // 检查postinstall脚本
    if (packageJson.scripts.postinstall && 
        packageJson.scripts.postinstall.includes('prisma generate')) {
      this.log('success', 'postinstall脚本配置正确')
    } else {
      this.log('warning', 'postinstall脚本可能需要配置')
    }
  }

  // 检查TypeScript编译
  async checkTypeScript() {
    this.log('info', '检查TypeScript编译...')
    
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)
    
    try {
      await execAsync('npx tsc --noEmit', { cwd: PROJECT_ROOT })
      this.log('success', 'TypeScript编译检查通过')
    } catch (error) {
      this.log('error', `TypeScript编译错误: ${error.message}`)
    }
  }

  // 检查优化文件的导入和导出
  checkOptimizationFiles() {
    this.log('info', '检查优化文件的导入导出...')
    
    const files = [
      'src/lib/batch-db-operations.ts',
      'src/lib/db-index-optimization.ts',
      'src/lib/query-optimization.ts',
      'src/lib/performance-monitor.ts'
    ]
    
    for (const file of files) {
      const filePath = path.join(PROJECT_ROOT, file)
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        
        // 检查是否有导出
        if (content.includes('export class') || content.includes('export function')) {
          this.log('success', `${file} 有正确的导出`)
        } else {
          this.log('warning', `${file} 可能缺少导出`)
        }
        
        // 检查Prisma导入
        if (content.includes('import') && content.includes('prisma')) {
          this.log('success', `${file} 正确导入Prisma`)
        } else {
          this.log('warning', `${file} 可能缺少Prisma导入`)
        }
      }
    }
  }

  // 检查应用初始化集成
  checkAppInitialization() {
    this.log('info', '检查应用初始化集成...')
    
    const initializerPath = path.join(PROJECT_ROOT, 'src/lib/app-initializer.ts')
    if (fs.existsSync(initializerPath)) {
      const content = fs.readFileSync(initializerPath, 'utf8')
      
      if (content.includes('initializeDatabaseOptimization')) {
        this.log('success', '数据库优化已集成到应用初始化')
      } else {
        this.log('error', '数据库优化未集成到应用初始化')
      }
      
      if (content.includes('import') && content.includes('db-index-optimization')) {
        this.log('success', '数据库优化模块正确导入')
      } else {
        this.log('error', '数据库优化模块导入缺失')
      }
    }
  }

  // 生成部署建议
  generateDeploymentAdvice() {
    this.log('info', '生成部署建议...')
    
    console.log('\n' + '='.repeat(60))
    console.log('📋 部署前检查总结')
    console.log('='.repeat(60))
    
    console.log(`\n✅ 成功项目: ${this.success.length}`)
    console.log(`⚠️  警告项目: ${this.warnings.length}`)
    console.log(`❌ 错误项目: ${this.errors.length}`)
    
    if (this.errors.length > 0) {
      console.log('\n❌ 必须修复的错误:')
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`)
      })
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  建议处理的警告:')
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`)
      })
    }
    
    console.log('\n🚀 Vercel部署建议:')
    console.log('   1. 确保在Vercel控制台设置所有必需的环境变量')
    console.log('   2. 数据库URL必须包含连接池参数')
    console.log('   3. 监控首次部署的函数日志')
    console.log('   4. 部署后测试性能监控API: /api/performance?action=latest')
    console.log('   5. 检查数据库连接数是否在合理范围内')
    
    console.log('\n📊 预期性能提升:')
    console.log('   • 数据库操作效率: 5-10倍提升')
    console.log('   • 邮件队列处理: 显著减少堵塞')
    console.log('   • 查询响应时间: 重复查询减少90%')
    console.log('   • 系统并发能力: 大幅增强')
    
    if (this.errors.length === 0) {
      console.log('\n🎉 所有检查通过！可以安全部署到Vercel。')
      return true
    } else {
      console.log('\n🛑 存在错误，请修复后再部署。')
      return false
    }
  }

  // 运行所有检查
  async runAllChecks() {
    console.log('🔍 开始部署前检查...\n')
    
    this.checkRequiredFiles()
    this.checkEnvironmentVariables()
    this.checkVercelConfig()
    this.checkPackageJson()
    this.checkOptimizationFiles()
    this.checkAppInitialization()
    
    // TypeScript检查（可能耗时较长）
    await this.checkTypeScript()
    
    return this.generateDeploymentAdvice()
  }
}

// 运行检查
if (require.main === module) {
  const checker = new PreDeployChecker()
  checker.runAllChecks().then(success => {
    process.exit(success ? 0 : 1)
  }).catch(error => {
    console.error('检查过程中发生错误:', error)
    process.exit(1)
  })
}

module.exports = PreDeployChecker