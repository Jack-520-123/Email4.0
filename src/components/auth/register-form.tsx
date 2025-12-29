"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import Link from "next/link"
import axios from "axios"

export default function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (data: { name: string; email: string; password: string; confirmPassword: string }) => {
    try {
      if (data.password !== data.confirmPassword) {
        setError("两次输入的密码不一致")
        return
      }

      setLoading(true)
      setError(null)
      
      // 发送注册请求到API
      await axios.post('/api/register', {
        name: data.name,
        email: data.email,
        password: data.password,
      })
      
      // 注册成功，跳转到登录页
      router.push("/auth/login?registered=true")
    } catch (error: any) {
      if (error.response?.data?.error) {
        setError(error.response.data.error)
      } else {
        setError("注册过程中出现错误")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">注册新账号</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">创建您的账号开始使用欢喜邮件营销系统</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-4">
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            姓名
          </label>
          <input
            {...register("name", { required: "请输入姓名" })}
            type="text"
            id="name"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="请输入您的姓名"
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            邮箱
          </label>
          <input
            {...register("email", { 
              required: "请输入邮箱",
              pattern: { 
                value: /\S+@\S+\.\S+/, 
                message: "请输入有效的邮箱地址" 
              }
            })}
            type="email"
            id="email"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="请输入您的邮箱地址"
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            密码
          </label>
          <input
            {...register("password", { 
              required: "请输入密码",
              minLength: { value: 6, message: "密码至少需要6个字符" }
            })}
            type="password"
            id="password"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="请设置您的密码"
          />
          {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
        </div>

        <div className="mb-6">
          <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            确认密码
          </label>
          <input
            {...register("confirmPassword", { required: "请确认您的密码" })}
            type="password"
            id="confirmPassword"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="请再次输入您的密码"
          />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400"
        >
          {loading ? "注册中..." : "注册"}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <p className="text-gray-600 dark:text-gray-400">
          已有账号？{" "}
          <Link href="/auth/login" className="font-medium text-blue-600 hover:underline dark:text-blue-500">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  )
}