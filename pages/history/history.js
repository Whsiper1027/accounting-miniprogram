Page({
  data: {
    types: ['全部'],
    selectedType: '',
    selectedTypeLabel: '全部',
    selectedTypeIndex: 0,
    selectedMonth: '',
    selectedMonthLabel: '',
    currentMonth: '',
    monthOptions: [],
    records: [],
    totalAmount: 0,
    recordCount: 0,
    dailyAvg: 0,
    categoryStats: [],
    showMonthDropdown: false,
    showTypeDropdown: false,
    emptyText: '暂无记录'
  },

  onLoad() {
    // 设置当前月份
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const currentMonth = `${year}-${month}`

    this.setData({
      selectedMonth: currentMonth,
      selectedMonthLabel: `${year}年${parseInt(month)}月`,
      currentMonth: currentMonth
    })

    this.generateMonthOptions()
    this.loadTypes()
    this.loadRecords()
  },

  onShow() {
    this.loadTypes()
    this.loadRecords()
  },

  // 生成月份选项（最近 12 个月）
  generateMonthOptions() {
    const options = []
    const now = new Date()

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const value = `${year}-${month}`
      const label = `${year}年${parseInt(month)}月`

      options.push({ value, label })
    }

    this.setData({
      monthOptions: options
    })
  },

  // 加载类型列表
  loadTypes() {
    // 从本地存储读取分类
    const categories = wx.getStorageSync('accounting_categories') || []
    let types = ['全部']

    // 如果存储为空，初始化默认分类
    if (categories.length === 0) {
      const defaultTypes = ['餐饮', '交通', '购物', '游戏', '羽毛球', '理发', '住宿']
      types = ['全部', ...defaultTypes]
    } else {
      // 只使用存储中的分类（与分类管理页面保持一致）
      const allTypes = categories.map(cat => cat.name)
      types = ['全部', ...allTypes]
    }

    const currentType = this.data.selectedType
    const hasCurrentType = currentType && types.includes(currentType)
    const selectedTypeIndex = hasCurrentType ? types.indexOf(currentType) : 0

    this.setData({
      types,
      selectedType: hasCurrentType ? currentType : '',
      selectedTypeIndex,
      selectedTypeLabel: hasCurrentType ? currentType : '全部'
    })
  },

  // 加载记录和统计
  loadRecords() {
    let records = wx.getStorageSync('accounting_records') || []
    const { selectedType, selectedMonth } = this.data

    // 类型筛选
    if (selectedType && selectedType !== '全部') {
      records = records.filter(item => item.type === selectedType)
    }

    // 月份筛选
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-')
      records = records.filter(item => {
        const itemDate = new Date(item.createdAt)
        return itemDate.getFullYear() === parseInt(year) &&
               itemDate.getMonth() === parseInt(month) - 1
      })
    }

    // 格式化时间
    const formattedRecords = records.map(item => {
      const date = new Date(item.createdAt)
      return {
        ...item,
        formattedTime: `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      }
    })

    // 按时间倒序
    formattedRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    // 计算统计
    const totalAmount = formattedRecords.reduce((sum, item) => sum + item.amount, 0)
    const recordCount = formattedRecords.length

    // 计算日均支出
    const now = new Date()
    const isCurrentMonth = selectedMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const days = isCurrentMonth ? now.getDate() : new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate()
    const dailyAvg = days > 0 && recordCount > 0 ? (totalAmount / days).toFixed(2) : 0

    // 按类型统计
    const categoryMap = {}
    formattedRecords.forEach(item => {
      if (!categoryMap[item.type]) {
        categoryMap[item.type] = 0
      }
      categoryMap[item.type] += item.amount
    })

    const colors = [
      '#a8e6cf', '#94e0c4', '#80dab9', '#6cd4ae', '#58cea3',
      '#c5edd7', '#d4f2e0', '#e2f6ea', '#edfaf3', '#f6fdfa'
    ]

    const categoryStats = Object.entries(categoryMap).map(([name, amount], index) => ({
      name,
      amount: amount.toFixed(2),
      percent: totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : 0,
      color: colors[index % colors.length]
    })).sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))

    // 生成饼图渐变
    const pieGradient = this.generatePieGradient(categoryStats)
    const selectedMonthLabel = this.getSelectedMonthLabel(selectedMonth)
    const selectedTypeLabel = selectedType || '全部'
    const emptyText = this.getEmptyText(selectedMonthLabel, selectedTypeLabel)

    this.setData({
      records: formattedRecords,
      totalAmount: totalAmount.toFixed(2),
      recordCount,
      dailyAvg,
      categoryStats,
      pieGradient,
      selectedMonthLabel,
      selectedTypeLabel,
      emptyText
    })
  },

  // 切换月份下拉
  toggleMonthDropdown() {
    this.setData({
      showMonthDropdown: !this.data.showMonthDropdown,
      showTypeDropdown: false
    })
  },

  // 选择月份
  selectMonth(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      selectedMonth: value,
      showMonthDropdown: false
    })
    this.loadRecords()
  },

  // 切换分类下拉
  toggleTypeDropdown() {
    this.setData({
      showTypeDropdown: !this.data.showTypeDropdown,
      showMonthDropdown: false
    })
  },

  // 选择分类
  selectType(e) {
    const index = e.currentTarget.dataset.index
    const selectedType = this.data.types[index]
    this.setData({
      selectedType: selectedType === '全部' ? '' : selectedType,
      selectedTypeIndex: index,
      showTypeDropdown: false
    })
    this.loadRecords()
  },

  getSelectedMonthLabel(selectedMonth) {
    const selectedOption = this.data.monthOptions.find(item => item.value === selectedMonth)

    if (selectedOption) {
      return selectedOption.label
    }

    const [year, month] = selectedMonth.split('-')
    return `${year}年${parseInt(month)}月`
  },

  getEmptyText(monthLabel, typeLabel) {
    if (typeLabel && typeLabel !== '全部') {
      return `${monthLabel}暂无“${typeLabel}”记录`
    }

    return `${monthLabel}暂无记录`
  },

  // 生成饼图渐变
  generatePieGradient(stats) {
    if (stats.length === 0) return ''

    let currentPercent = 0
    const gradients = []

    stats.forEach(item => {
      const percent = parseFloat(item.percent)
      const start = currentPercent
      const end = currentPercent + percent
      gradients.push(`${item.color} ${start}% ${end}%`)
      currentPercent = end
    })

    return gradients.join(', ')
  }
})
