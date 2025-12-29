// 统一的颜色配置
export const DASHBOARD_COLORS = {
  // 主色调 - 蓝色系
  primary: {
    50: '#eff6ff',
    100: '#dbeafe', 
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // 主蓝色
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a'
  },
  
  // 成功色 - 绿色系
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0', 
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // 主绿色
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d'
  },
  
  // 警告色 - 橙色系
  warning: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74', 
    400: '#fb923c',
    500: '#f97316', // 主橙色
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12'
  },
  
  // 错误色 - 红色系
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444', // 主红色
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d'
  },
  
  // 信息色 - 青色系
  info: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4', // 主青色
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63'
  },
  
  // 紫色系
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7', // 主紫色
    600: '#9333ea',
    700: '#7c3aed',
    800: '#6b21a8',
    900: '#581c87'
  },
  
  // 灰色系
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  }
}

// 图表专用颜色配置
export const CHART_COLORS = {
  // 主要数据系列颜色（按优先级排序）
  series: [
    DASHBOARD_COLORS.primary[500],   // 蓝色 - 发送/主要数据
    DASHBOARD_COLORS.success[500],   // 绿色 - 成功/送达
    DASHBOARD_COLORS.warning[500],   // 橙色 - 警告/待处理
    DASHBOARD_COLORS.error[500],     // 红色 - 错误/失败
    DASHBOARD_COLORS.info[500],      // 青色 - 信息/点击
    DASHBOARD_COLORS.purple[500],    // 紫色 - 特殊/其他
  ],
  
  // 状态颜色映射
  status: {
    sent: DASHBOARD_COLORS.primary[500],      // 发送 - 蓝色
    delivered: DASHBOARD_COLORS.success[500], // 送达 - 绿色
    opened: DASHBOARD_COLORS.info[500],       // 打开 - 青色
    clicked: DASHBOARD_COLORS.warning[500],   // 点击 - 橙色
    failed: DASHBOARD_COLORS.error[500],      // 失败 - 红色
    bounced: DASHBOARD_COLORS.warning[600],   // 退回 - 深橙色
    rejected: DASHBOARD_COLORS.error[600],    // 拒收 - 深红色
    pending: DASHBOARD_COLORS.gray[400],      // 等待 - 灰色
    blacklisted: DASHBOARD_COLORS.gray[600],  // 黑名单 - 深灰色
  },
  
  // 渐变色配置
  gradients: {
    primary: `linear-gradient(135deg, ${DASHBOARD_COLORS.primary[400]} 0%, ${DASHBOARD_COLORS.primary[600]} 100%)`,
    success: `linear-gradient(135deg, ${DASHBOARD_COLORS.success[400]} 0%, ${DASHBOARD_COLORS.success[600]} 100%)`,
    warning: `linear-gradient(135deg, ${DASHBOARD_COLORS.warning[400]} 0%, ${DASHBOARD_COLORS.warning[600]} 100%)`,
    error: `linear-gradient(135deg, ${DASHBOARD_COLORS.error[400]} 0%, ${DASHBOARD_COLORS.error[600]} 100%)`,
  },
  
  // 背景色配置
  backgrounds: {
    primary: DASHBOARD_COLORS.primary[50],
    success: DASHBOARD_COLORS.success[50],
    warning: DASHBOARD_COLORS.warning[50],
    error: DASHBOARD_COLORS.error[50],
    info: DASHBOARD_COLORS.info[50],
    purple: DASHBOARD_COLORS.purple[50],
  }
}

// 词云颜色配置
export const WORD_CLOUD_COLORS = [
  DASHBOARD_COLORS.primary[500],
  DASHBOARD_COLORS.success[500],
  DASHBOARD_COLORS.warning[500],
  DASHBOARD_COLORS.info[500],
  DASHBOARD_COLORS.purple[500],
  DASHBOARD_COLORS.primary[600],
  DASHBOARD_COLORS.success[600],
  DASHBOARD_COLORS.warning[600],
  DASHBOARD_COLORS.info[600],
  DASHBOARD_COLORS.purple[600]
]

// 参与度评分颜色
export const ENGAGEMENT_COLORS = {
  excellent: { bg: DASHBOARD_COLORS.success[50], text: DASHBOARD_COLORS.success[700] },  // 80%+
  good: { bg: DASHBOARD_COLORS.info[50], text: DASHBOARD_COLORS.info[700] },           // 60-79%
  average: { bg: DASHBOARD_COLORS.warning[50], text: DASHBOARD_COLORS.warning[700] },  // 40-59%
  poor: { bg: DASHBOARD_COLORS.error[50], text: DASHBOARD_COLORS.error[700] }          // <40%
}

// 导出默认颜色数组（兼容现有代码）
export const COLORS = CHART_COLORS.series

// 获取参与度颜色的辅助函数
export const getEngagementColor = (score: number) => {
  if (score >= 80) return `text-${DASHBOARD_COLORS.success[700]} bg-${DASHBOARD_COLORS.success[50]}`
  if (score >= 60) return `text-${DASHBOARD_COLORS.info[700]} bg-${DASHBOARD_COLORS.info[50]}`
  if (score >= 40) return `text-${DASHBOARD_COLORS.warning[700]} bg-${DASHBOARD_COLORS.warning[50]}`
  return `text-${DASHBOARD_COLORS.error[700]} bg-${DASHBOARD_COLORS.error[50]}`
}

// 获取状态颜色的辅助函数
export const getStatusColor = (status: string) => {
  return CHART_COLORS.status[status as keyof typeof CHART_COLORS.status] || DASHBOARD_COLORS.gray[500]
}