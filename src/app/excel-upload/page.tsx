'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface ExcelUpload {
  id: string
  originalName: string
  totalRecords: number
  status: string
  createdAt: string
  campaigns: Array<{
    id: string
    name: string
    status: string
    sentCount: number
    totalRecipients: number
  }>
}

export default function ExcelUploadPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [uploads, setUploads] = useState<ExcelUpload[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchUploads()
    }
  }, [status, router])

  const fetchUploads = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/excel-upload')
      const data = await response.json()
      
      if (data.uploads) {
        setUploads(data.uploads)
      }
    } catch (error) {
      console.error('获取上传历史失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('请选择文件')
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/excel-upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        alert('文件上传成功！')
        setSelectedFile(null)
        setPreview(data.upload.preview || [])
        fetchUploads()
        
        // 重置文件输入
        const fileInput = document.getElementById('file-input') as HTMLInputElement
        if (fileInput) {
          fileInput.value = ''
        }
      } else {
        alert(data.error || '上传失败')
      }
    } catch (error) {
      console.error('上传失败:', error)
      alert('上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'completed': '已完成',
      'processing': '处理中',
      'failed': '失败'
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'completed': 'text-green-600',
      'processing': 'text-yellow-600',
      'failed': 'text-red-600'
    }
    return colorMap[status] || 'text-gray-600'
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Excel文件管理</h1>
          <p className="mt-2 text-gray-600">上传Excel文件添加收件人，支持批量邮件发送</p>
        </div>

        {/* 文件上传区域 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">上传Excel文件</h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="mt-4">
                <label htmlFor="file-input" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    点击选择Excel文件或拖拽文件到此处
                  </span>
                  <input
                    id="file-input"
                    type="file"
                    className="sr-only"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                  />
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  支持 .xlsx 和 .xls 格式，文件必须包含邮箱列
                </p>
              </div>
            </div>
          </div>

          {selectedFile && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">已选择文件:</p>
                  <p className="text-sm text-blue-700">{selectedFile.name}</p>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? '上传中...' : '上传文件'}
                </button>
              </div>
            </div>
          )}

          {preview.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">数据预览 (前5行)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(preview[0]).map((key) => (
                        <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value: any, cellIndex) => (
                          <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 上传历史 */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">上传历史</h2>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : uploads.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-gray-500">暂无上传记录</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文件名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      记录数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      上传时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      关联活动
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {uploads.map((upload) => (
                    <tr key={upload.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {upload.originalName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {upload.totalRecords}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm ${getStatusColor(upload.status)}`}>
                          {getStatusText(upload.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(upload.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {upload.campaigns.length > 0 ? (
                          <div>
                            {upload.campaigns.map((campaign) => (
                              <div key={campaign.id} className="mb-1">
                                <span className="text-blue-600">{campaign.name}</span>
                                <span className="ml-2 text-xs text-gray-500">
                                  ({campaign.sentCount}/{campaign.totalRecipients})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">未使用</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => router.push(`/campaigns/create?excelId=${upload.id}`)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          创建活动
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}