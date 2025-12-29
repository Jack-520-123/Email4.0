import { redirect } from 'next/navigation'

export default function Home() {
  // 暂时跳转到登录页面
  redirect('/auth/login')
  
  return null
}