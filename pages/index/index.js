Page({
  data: {
    types: [],
    selectedTypeIndex: 0,
    selectedType: '',
    amount: '',
    note: '',
    todayTotal: 0,
    weekTotal: 0,
    monthTotal: 0
  },

  onLoad() {
    this.loadCategories()
    this.loadSummary()
  },

  onShow() {
    this.loadCategories()
    this.loadSummary()
  },

  // 加载分类列表
  loadCategories() {
    // 从本地存储读取分类
    const categories = wx.getStorageSync('accounting_categories') || []

    // 如果存储为空，初始化默认分类
    if (categories.length === 0) {
      const defaultCategories = [
        { name: '餐饮' },
        { name: '交通' },
        { name: '购物' },
        { name: '游戏' },
        { name: '羽毛球' },
        { name: '理发' },
        { name: '住宿' }
      ]
      const allTypes = defaultCategories.map(cat => cat.name)
      this.setData({
        types: allTypes,
        selectedTypeIndex: 0,
        selectedType: allTypes[0] || ''
      })
    } else {
      // 只使用存储中的分类（与分类管理页面保持一致）
      const allTypes = categories.map(cat => cat.name)
      this.setData({
        types: allTypes,
        selectedTypeIndex: 0,
        selectedType: allTypes[0] || ''
      })
    }
  },

  // 选择类型
  selectType(e) {
    const type = e.currentTarget.dataset.type
    const index = this.data.types.indexOf(type)
    this.setData({
      selectedType: type,
      selectedTypeIndex: index
    })
  },

  // 金额输入
  onAmountInput(e) {
    this.setData({
      amount: e.detail.value
    })
  },

  // 备注输入
  onNoteInput(e) {
    this.setData({
      note: e.detail.value
    })
  },

  // 提交记录
  submitRecord() {
    const { selectedType, amount, note } = this.data

    if (!amount || parseFloat(amount) <= 0) {
      wx.showToast({
        title: '请输入金额',
        icon: 'none'
      })
      return
    }

    // 从本地存储读取现有记录
    const records = wx.getStorageSync('accounting_records') || []

    // 添加新记录
    const newRecord = {
      _id: Date.now().toString(),
      type: selectedType,
      amount: parseFloat(amount),
      note: note,
      createdAt: new Date().toISOString()
    }

    records.push(newRecord)

    // 保存到本地存储
    wx.setStorageSync('accounting_records', records)

    wx.showToast({
      title: '记账成功',
      icon: 'success'
    })

    this.setData({
      amount: '',
      note: ''
    })

    this.loadSummary()
  },

  // 加载汇总数据
  loadSummary() {
    const records = wx.getStorageSync('accounting_records') || []

    // 今天的开始和结束
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 本周的开始（周一）
    const weekStart = new Date(today)
    const dayOfWeek = weekStart.getDay() || 7
    weekStart.setDate(weekStart.getDate() - dayOfWeek + 1)

    // 本月的开始
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    // 计算汇总
    let todayTotal = 0
    let weekTotal = 0
    let monthTotal = 0

    records.forEach(item => {
      const itemDate = new Date(item.createdAt)

      if (itemDate >= today && itemDate < tomorrow) {
        todayTotal += item.amount
      }

      if (itemDate >= weekStart) {
        weekTotal += item.amount
      }

      if (itemDate >= monthStart) {
        monthTotal += item.amount
      }
    })

    this.setData({
      todayTotal: todayTotal.toFixed(2),
      weekTotal: weekTotal.toFixed(2),
      monthTotal: monthTotal.toFixed(2)
    })
  }
})
