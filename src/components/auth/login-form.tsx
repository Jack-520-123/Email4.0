"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  })
  
  const onSubmit = async (data: { email: string; password: string }) => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      })
      
      if (result?.error) {
        setError(result.error)
        return
      }
      
      router.push("/dashboard")
    } catch (error) {
      setError("登录过程中出现错误")
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm p-8 shadow-2xl dark:border-gray-700 dark:bg-gray-800/95">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">登录欢喜邮件营销系统</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">输入您的账号和密码继续使用</p>
      </div>
      
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-4">
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            邮箱
          </label>
          <input
            {...register("email", { required: "请输入邮箱" })}
            type="text"
            id="email"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="请输入邮箱地址或用户名"
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>
        
        <div className="mb-6">
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            密码
          </label>
          <input
            {...register("password", { required: "请输入密码" })}
            type="password"
            id="password"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="请输入密码"
          />
          {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
      
      <div className="mt-6 text-center text-sm">
        <p className="text-gray-600 dark:text-gray-400">
          还没有账号？{" "}
          <Link href="/auth/register" className="font-medium text-blue-600 hover:underline dark:text-blue-500">
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}