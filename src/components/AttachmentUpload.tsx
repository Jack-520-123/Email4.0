'use client'

import React, { useState, useRef } from 'react'
import { Upload, X, File, Image, FileText, Archive } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface AttachmentFile {
  name: string
  size: number
  type: string
  url: string
  fileName: string
}

interface AttachmentUploadProps {
  onAttachmentAdd: (attachment: AttachmentFile) => void
  onAttachmentRemove: (fileName: string) => void
  attachments: AttachmentFile[]
  maxFiles?: number
  maxSize?: number // MB
}

const AttachmentUpload: React.FC<AttachmentUploadProps> = ({
  onAttachmentAdd,
  onAttachmentRemove,
  attachments,
  maxFiles = 10,
  maxSize = 10
}) => {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="w-4 h-4" />
    } else if (type.includes('pdf')) {
      return <FileText className="w-4 h-4 text-red-500" />
    } else if (type.includes('word') || type.includes('document')) {
      return <FileText className="w-4 h-4 text-blue-500" />
    } else if (type.includes('excel') || type.includes('sheet')) {
      return <FileText className="w-4 h-4 text-green-500" />
    } else if (type.includes('zip') || type.includes('rar')) {
      return <Archive className="w-4 h-4 text-yellow-500" />
    } else {
      return <File className="w-4 h-4" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (attachments.length + files.length > maxFiles) {
      toast.error(`最多只能上传 ${maxFiles} 个附件`)
      return
    }

    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        if (file.size > maxSize * 1024 * 1024) {
          toast.error(`文件 ${file.name} 大小超过 ${maxSize}MB`)
          continue
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'attachment')

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        })

        const result = await response.json()

        if (result.success) {
          onAttachmentAdd(result.file)
          toast.success(`文件 ${file.name} 上传成功`)
        } else {
          toast.error(result.error || `文件 ${file.name} 上传失败`)
        }
      }
    } catch (error) {
      console.error('上传失败:', error)
      toast.error('文件上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveAttachment = (fileName: string) => {
    onAttachmentRemove(fileName)
    toast.success('附件已移除')
  }

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.jpg,.jpeg,.png,.gif,.webp"
        />
        
        <div className="space-y-2">
          <Upload className="w-8 h-8 text-gray-400 mx-auto" />
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || attachments.length >= maxFiles}
              className="text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400"
            >
              {uploading ? '上传中...' : '点击上传附件'}
            </button>
            <p className="text-sm text-gray-500 mt-1">
              支持 PDF、Word、Excel、PPT、图片、压缩包等格式
            </p>
            <p className="text-xs text-gray-400">
              单个文件最大 {maxSize}MB，最多 {maxFiles} 个文件
            </p>
          </div>
        </div>
      </div>

      {/* 附件列表 */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">已上传附件 ({attachments.length})</h4>
          <div className="space-y-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFileIcon(attachment.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(attachment.fileName)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AttachmentUpload