Page({
  data: {
    categories: [],
    showPanel: false,
    isEditing: false,
    editingId: null,
    currentItem: null,
    inputValue: ''
  },

  // 首次运行的默认分类
  defaultCategories: [
    { id: 'default_1', name: '餐饮', builtin: true },
    { id: 'default_2', name: '交通', builtin: true },
    { id: 'default_3', name: '购物', builtin: true },
    { id: 'default_4', name: '游戏', builtin: true },
    { id: 'default_5', name: '羽毛球', builtin: true },
    { id: 'default_6', name: '理发', builtin: true },
    { id: 'default_7', name: '住宿', builtin: true }
  ],

  onLoad() {
    this.initCategories()
  },

  onShow() {
    this.loadCategories()
  },

  // 初始化分类（首次运行）
  initCategories() {
    const categories = wx.getStorageSync('accounting_categories')
    console.log('初始化检查，读取到的分类:', categories)

    if (!categories || categories.length === 0) {
      // 首次运行，初始化默认分类（深拷贝避免引用问题）
      const initialCategories = JSON.parse(JSON.stringify(this.defaultCategories))
      wx.setStorageSync('accounting_categories', initialCategories)
      console.log('首次运行，初始化默认分类')
    } else {
      // 非首次运行，检查并去重
      const dedupedCategories = this.deduplicateCategories(categories)
      if (dedupedCategories.length !== categories.length) {
        // 有重复数据，更新存储
        wx.setStorageSync('accounting_categories', dedupedCategories)
        console.log('分类去重完成，原数量:', categories.length, '去重后:', dedupedCategories.length)
      } else {
        console.log('分类无重复，数量:', categories.length)
      }
    }
    this.loadCategories()
  },

  // 分类去重（按 name 去重，保留第一个）
  deduplicateCategories(categories) {
    const nameMap = {}
    const result = []

    for (const cat of categories) {
      if (!nameMap[cat.name]) {
        nameMap[cat.name] = true
        result.push(cat)
      }
    }

    return result
  },

  // 加载分类列表
  loadCategories() {
    const categories = (wx.getStorageSync('accounting_categories') || []).map(cat => ({
      ...cat,
      builtin: Boolean(cat.builtin)
    }))
    this.setData({
      categories: categories
    })
  },

  // 显示添加面板
  showAddPanel() {
    this.setData({
      showPanel: true,
      isEditing: false,
      editingId: null,
      currentItem: null,
      inputValue: ''
    })
  },

  // 编辑分类
  editCategory(e) {
    const id = e.currentTarget.dataset.id
    const category = this.data.categories.find(cat => cat.id === id)

    if (category) {
      if (category.builtin) {
        wx.showToast({
          title: '默认分类不支持编辑',
          icon: 'none'
        })
        return
      }

      this.setData({
        showPanel: true,
        isEditing: true,
        editingId: id,
        currentItem: category,
        inputValue: category.name
      })
    }
  },

  // 长按显示删除操作
  showDeleteAction(e) {
    const item = e.currentTarget.dataset.item

    if (item.builtin) {
      wx.showToast({
        title: '默认分类不支持删除',
        icon: 'none'
      })
      return
    }

    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.editCategory({ currentTarget: { dataset: { id: item.id } } })
        } else if (res.tapIndex === 1) {
          this.confirmDelete(item.id)
        }
      }
    })
  },

  // 确认删除
  confirmDelete(id) {
    console.log('删除分类，id:', id)
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个分类吗？已使用该分类的记录不会受影响。',
      success: (res) => {
        if (res.confirm) {
          let categories = wx.getStorageSync('accounting_categories') || []
          console.log('删除前分类数:', categories.length)
          console.log('删除前数据:', categories)

          const targetCat = categories.find(cat => cat.id === id)
          console.log('要删除的分类:', targetCat)

          if (targetCat && targetCat.builtin) {
            wx.showToast({
              title: '默认分类不支持删除',
              icon: 'none'
            })
            return
          }

          categories = categories.filter(cat => cat.id !== id)
          console.log('删除后分类数:', categories.length)

          wx.setStorageSync('accounting_categories', categories)
          this.loadCategories()

          wx.showToast({
            title: '删除成功',
            icon: 'success'
          })
        }
      }
    })
  },

  // 从面板删除
  confirmDeleteFromPanel() {
    const { editingId } = this.data
    if (editingId) {
      this.confirmDelete(editingId)
      this.hidePanel()
    }
  },

  // 隐藏面板
  hidePanel() {
    this.setData({
      showPanel: false,
      isEditing: false,
      editingId: null,
      currentItem: null,
      inputValue: ''
    })
  },

  // 输入框变化
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    })
  },

  // 确认保存
  confirmSave() {
    const { isEditing, editingId, inputValue } = this.data
    console.log('保存分类，isEditing:', isEditing, 'editingId:', editingId, 'inputValue:', inputValue)

    if (!inputValue || !inputValue.trim()) {
      wx.showToast({
        title: '请输入分类名称',
        icon: 'none'
      })
      return
    }

    const categoryName = inputValue.trim()

    if (isEditing && editingId) {
      // 编辑模式
      let categories = wx.getStorageSync('accounting_categories') || []
      console.log('编辑前分类列表:', categories)

      const index = categories.findIndex(cat => cat.id === editingId)
      console.log('编辑索引:', index)

      if (index !== -1) {
        // 检查重名（排除自己）
        const otherNames = categories.filter((cat, i) => i !== index).map(cat => cat.name)
        console.log('其他分类名称:', otherNames)

        if (otherNames.includes(categoryName)) {
          wx.showToast({
            title: '分类名称已存在',
            icon: 'none'
          })
          return
        }

        categories[index].name = categoryName
        console.log('编辑后分类列表:', categories)

        wx.setStorageSync('accounting_categories', categories)

        this.loadCategories()
        this.hidePanel()

        wx.showToast({
          title: '编辑成功',
          icon: 'success'
        })
      }
    } else {
      // 添加模式
      let categories = wx.getStorageSync('accounting_categories') || []
      console.log('添加前分类列表:', categories)

      // 检查是否重名
      const allTypes = categories.map(cat => cat.name)
      console.log('现有分类名称:', allTypes)

      if (allTypes.includes(categoryName)) {
        wx.showToast({
          title: '分类名称已存在',
          icon: 'none'
        })
        return
      }

      const newCategory = {
        id: `cat_${Date.now()}`,
        name: categoryName
      }

      categories.push(newCategory)
      wx.setStorageSync('accounting_categories', categories)

      this.loadCategories()
      this.hidePanel()

      wx.showToast({
        title: '添加成功',
        icon: 'success'
      })
    }
  },

  // 阻止冒泡
  stopPropagation() {
    // 空函数
  }
})
