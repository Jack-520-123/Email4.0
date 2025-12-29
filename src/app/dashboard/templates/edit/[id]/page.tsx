"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Editor } from "@tinymce/tinymce-react"
import { Save, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

interface Template {
  id: string
  name: string
  subject: string
  content: string
  isRichText: boolean
}

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const { data: session, status } = useSession()
  const [template, setTemplate] = useState<Template | null>(null)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 获取模板数据
  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/templates/${params.id}`)
      if (!response.ok) {
        throw new Error('获取模板失败')
      }
      const data = await response.json()
      setTemplate(data)
      setName(data.name)
      setSubject(data.subject)
      setContent(data.content)
    } catch (error) {
      console.error('获取模板失败:', error)
      alert('获取模板失败')
      router.push('/dashboard/templates')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !subject || !content) {
      alert("请填写所有必填字段")
      return
    }
    
    try {
      setSaving(true)
      
      const response = await fetch(`/api/templates/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject, content }),
      })
      
      if (!response.ok) {
        throw new Error('更新模板失败')
      }
      
      alert('模板更新成功')
      router.push("/dashboard/templates")
    } catch (error) {
      console.error("更新模板失败:", error)
      alert(error instanceof Error ? error.message : "更新模板失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetchTemplate()
  }, [session, status, params.id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">模板不存在</h2>
          <Link href="/dashboard/templates" className="mt-4 text-blue-600 hover:text-blue-500">
            返回模板列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/templates"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="sr-only">返回</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">编辑邮件模板</h1>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !name || !subject || !content}
          className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400"
        >
          {saving ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              保存模板
            </>
          )}
        </button>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                模板名称
              </label>
              <input
                type="text"
                id="name"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="输入模板名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="subject" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                邮件主题
              </label>
              <input
                type="text"
                id="subject"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="输入邮件主题"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="content" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                邮件内容
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const editor = (window as any).tinymce?.activeEditor
                    if (editor) {
                      editor.insertContent('{{recipient_name}}')
                    }
                  }}
                  className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                >
                  插入收件人姓名 {'{'}{'{'} recipient_name {'}'}{'}'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const editor = (window as any).tinymce?.activeEditor
                    if (editor) {
                      editor.insertContent('{{greeting}}')
                    }
                  }}
                  className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
                >
                  插入问候语 {'{'}{'{'} greeting {'}'}{'}'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const editor = (window as any).tinymce?.activeEditor
                    if (editor) {
                      editor.insertContent('{{timestamp}}')
                    }
                  }}
                  className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                >
                  插入时间戳 {'{'}{'{'} timestamp {'}'}{'}'}
                </button>
              </div>
              <div className="min-h-[400px] rounded-md border border-gray-300 dark:border-gray-600">
                <Editor
                  initialValue={content}
                  init={{
                    height: 400,
                    menubar: false,
                    plugins: [
                      "advlist", "autolink", "lists", "link", "image", "charmap", "preview", 
                      "searchreplace", "visualblocks", "code", "fullscreen",
                      "insertdatetime", "media", "table", "code", "help", "wordcount"
                    ],
                    toolbar:
                      "undo redo | formatselect | bold italic backcolor | \
                      alignleft aligncenter alignright alignjustify | \
                      bullist numlist outdent indent | removeformat | help",
                    content_style: "body { font-family:Helvetica,Arial,sans-serif; font-size:14px }",
                  }}
                  onEditorChange={(newContent) => setContent(newContent)}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                使用富文本编辑器编辑您的邮件内容。支持添加图片、链接、表格等格式。点击上方按钮可快速插入占位符。
              </div>
            </div>

            <div className="bg-blue-50 p-4 dark:bg-blue-900/20">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">可用变量标签</h3>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                您可以在邮件内容中使用以下变量，系统会在发送时自动替换：
              </p>
              <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-400">
                <li><code>{"{{recipient_name}}"}</code> - 收件人姓名（来自Excel表格中的"姓名"列）</li>
                <li><code>{"{{greeting}}"}</code> - 问候语</li>
                <li><code>{"{{survey_link}}"}</code> - 调查链接</li>
                <li><code>{"{{manual_link}}"}</code> - 手册链接</li>
                <li><code>{"{{timestamp}}"}</code> - 时间戳</li>
              </ul>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}