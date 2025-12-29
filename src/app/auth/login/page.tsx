import LoginForm from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div 
      className="flex h-screen w-full items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: 'url(/images/login-background.jpg)',
      }}
    >
      {/* 半透明遮罩层 */}
      <div className="absolute inset-0 bg-black/20"></div>
      
      {/* 登录表单容器 */}
      <div className="relative z-10 w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  )
}