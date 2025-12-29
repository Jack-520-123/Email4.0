'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  Users, 
  Search, 
  Filter, 
  Tag, 
  Mail, 
  Eye, 
  MousePointer, 
  MessageSquare,
  Calendar,
  Building,
  MapPin,
  Smartphone,
  Monitor,
  Tablet,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Plus,
  X,
  Download,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { getEngagementColor } from '@/config/colors'
import { toast } from 'sonner'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'

interface UserProfile {
  id: string
  recipientEmail: string
  recipientName?: string
  company?: string
  position?: string
  industry?: string
  location?: string
  totalEmailsReceived: number
  totalEmailsOpened: number
  totalEmailsClicked: number
  totalReplies: number
  openRate: number
  clickRate: number
  replyRate: number
  engagementScore: number
  preferredEmailTime?: string
  deviceType?: string
  tags: string[]
  lastActivityAt?: string
  firstContactAt: string
  interactions: Array<{
    id: string
    type: string
    timestamp: string
    details?: any
  }>
}

interface RadarData {
  subject: string
  value: number
  fullMark: number
}

export default function UserProfilesPage() {
  const { data: session } = useSession()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'engagementScore' | 'lastActivityAt' | 'createdAt'>('engagementScore')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [radarData, setRadarData] = useState<RadarData[]>([])
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null)
  const [showTagModal, setShowTagModal] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [availableTags, setAvailableTags] = useState<string[]>([])

  // 获取用户画像列表
  const fetchProfiles = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy,
        sortOrder,
        ...(selectedTags.length > 0 && { tags: selectedTags.join(',') })
      })

      const response = await fetch(`/api/user-profiles?${params}`)
      if (!response.ok) throw new Error('获取用户画像失败')

      const data = await response.json()
      setProfiles(data.profiles || [])
      setTotalPages(data.pagination?.pages || 1)

      // 收集所有标签
      const allTags = new Set<string>()
      data.profiles?.forEach((profile: UserProfile) => {
        profile.tags?.forEach(tag => allTags.add(tag))
      })
      setAvailableTags(Array.from(allTags))
    } catch (error) {
      console.error('获取用户画像失败:', error)
      toast.error('获取用户画像失败')
    } finally {
      setLoading(false)
    }
  }

  // 获取雷达图数据
  const fetchRadarData = async () => {
    try {
      const response = await fetch('/api/user-profiles/radar')
      if (!response.ok) throw new Error('获取雷达图数据失败')

      const data = await response.json()
      setRadarData(data.data || [])
    } catch (error) {
      console.error('获取雷达图数据失败:', error)
    }
  }

  // 添加标签
  const addTag = async (profileId: string, tags: string[]) => {
    try {
      const response = await fetch(`/api/user-profiles/${profileId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      })

      if (!response.ok) throw new Error('添加标签失败')

      toast.success('标签添加成功')
      fetchProfiles()
    } catch (error) {
      console.error('添加标签失败:', error)
      toast.error('添加标签失败')
    }
  }

  // 移除标签
  const removeTag = async (profileId: string, tags: string[]) => {
    try {
      const response = await fetch(`/api/user-profiles/${profileId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      })

      if (!response.ok) throw new Error('移除标签失败')

      toast.success('标签移除成功')
      fetchProfiles()
    } catch (error) {
      console.error('移除标签失败:', error)
      toast.error('移除标签失败')
    }
  }

  // 过滤用户画像
  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = !searchTerm || 
      profile.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.recipientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.company?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  // 获取设备图标
  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="h-4 w-4" />
      case 'tablet': return <Tablet className="h-4 w-4" />
      case 'desktop': return <Monitor className="h-4 w-4" />
      default: return <Monitor className="h-4 w-4" />
    }
  }



  useEffect(() => {
    fetchProfiles()
    fetchRadarData()
  }, [page, sortBy, sortOrder, selectedTags])

  if (!session) {
    return <div className="flex items-center justify-center min-h-screen">请先登录</div>
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 页面头部 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">用户画像管理</h1>
            <p className="text-gray-600 mt-1">分析和管理收件人的行为数据与偏好</p>
          </div>
        </div>

        {/* 雷达图概览 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-6 text-gray-900">整体用户画像分析</h3>
          <div className="grid gap-8 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={300}>
              {radarData && radarData.length > 0 ? (
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <Radar
                    name="用户画像"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    formatter={(value) => [`${value}%`, '得分']}
                  />
                </RadarChart>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>暂无用户画像数据</p>
                  </div>
                </div>
              )}
            </ResponsiveContainer>
            
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">指标说明</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">打开率：邮件被打开的比例</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">点击率：链接被点击的比例</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-gray-600">回复率：邮件被回复的比例</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-600">参与度：综合互动指标</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">活跃度：最近30天活动频率</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 搜索和过滤 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索邮箱、姓名或公司..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="engagementScore">按参与度排序</option>
                <option value="lastActivityAt">按最后活动时间</option>
                <option value="createdAt">按创建时间</option>
              </select>
              
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </div>
          </div>
          
          {/* 标签过滤 */}
          {availableTags.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">按标签过滤：</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag))
                      } else {
                        setSelectedTags([...selectedTags, tag])
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 用户画像列表 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">用户画像列表</h3>
            <p className="text-sm text-gray-600 mt-1">共 {filteredProfiles.length} 个用户画像</p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">加载中...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无用户画像数据</p>
              <p className="text-sm mt-1">发送邮件后，系统将自动生成用户画像</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredProfiles.map((profile) => (
                <div key={profile.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-gray-900">
                          {profile.recipientName || profile.recipientEmail}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          getEngagementColor(profile.engagementScore)
                        }`}>
                          参与度 {profile.engagementScore.toFixed(0)}%
                        </span>
                        {profile.deviceType && (
                          <div className="flex items-center gap-1 text-gray-500">
                            {getDeviceIcon(profile.deviceType)}
                            <span className="text-xs">{profile.deviceType}</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">{profile.recipientEmail}</p>
                      
                      {(profile.company || profile.position || profile.industry) && (
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                          {profile.company && (
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              <span>{profile.company}</span>
                            </div>
                          )}
                          {profile.position && <span>{profile.position}</span>}
                          {profile.industry && <span>{profile.industry}</span>}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-6 text-sm text-gray-500 mb-3">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span>{profile.totalEmailsReceived} 封邮件</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>{profile.openRate.toFixed(1)}% 打开率</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MousePointer className="h-3 w-3" />
                          <span>{profile.clickRate.toFixed(1)}% 点击率</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>{profile.totalReplies} 次回复</span>
                        </div>
                      </div>
                      
                      {profile.tags && profile.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {profile.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                            >
                              <Tag className="h-2 w-2" />
                              {tag}
                              <button
                                onClick={() => removeTag(profile.id, [tag])}
                                className="hover:text-blue-900"
                              >
                                <X className="h-2 w-2" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>首次联系: {new Date(profile.firstContactAt).toLocaleDateString()}</span>
                        </div>
                        {profile.lastActivityAt && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>最后活动: {new Date(profile.lastActivityAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        {profile.preferredEmailTime && (
                          <span>偏好时间: {profile.preferredEmailTime}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedProfile(profile)
                          setShowTagModal(true)
                        }}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="h-3 w-3 inline mr-1" />
                        添加标签
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">
              第 {page} 页，共 {totalPages} 页
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {/* 添加标签模态框 */}
      {showTagModal && selectedProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">为 {selectedProfile.recipientName || selectedProfile.recipientEmail} 添加标签</h3>
            
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="输入新标签"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      addTag(selectedProfile.id, [newTag.trim()])
                      setNewTag('')
                      setShowTagModal(false)
                      setSelectedProfile(null)
                    }
                  }}
                />
              </div>
              
              {availableTags.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">或选择现有标签：</p>
                  <div className="flex flex-wrap gap-2">
                    {availableTags
                      .filter(tag => !selectedProfile.tags.includes(tag))
                      .map(tag => (
                        <button
                          key={tag}
                          onClick={() => {
                            addTag(selectedProfile.id, [tag])
                            setShowTagModal(false)
                            setSelectedProfile(null)
                          }}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                        >
                          {tag}
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTagModal(false)
                  setSelectedProfile(null)
                  setNewTag('')
                }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (newTag.trim()) {
                    addTag(selectedProfile.id, [newTag.trim()])
                    setNewTag('')
                    setShowTagModal(false)
                    setSelectedProfile(null)
                  }
                }}
                disabled={!newTag.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}