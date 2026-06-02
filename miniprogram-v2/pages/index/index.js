// ===================================================
// 视图枚举
// ===================================================
const VIEWS = {
  HOME: 'home',
  PROFILE: 'profile'
};

// ===================================================
// 模拟数据
// ===================================================
const MOCK_DATA = {
  // 单词书
  bookName: '高考课标 3500',
  bookTotal: 3500,
  bookLearned: 120,

  // 今日目标
  goalTotal: 4,
  goalDone: 2,

  // 连续打卡
  streakDays: 3,

  // 错词
  wrongCount: 8,
  eveningUnlocked: true
};

Page({
  data: {
    // 当前视图
    currentView: VIEWS.HOME,
    VIEWS,

    // 单词书进度
    bookName: MOCK_DATA.bookName,
    bookTotal: MOCK_DATA.bookTotal,
    bookLearned: MOCK_DATA.bookLearned,
    progressPercent: 0,          // 百分比文字 "3%"
    progressWidth: '0%',         // 进度条填充宽度，百分比字符串

    // 今日目标
    goalTotal: MOCK_DATA.goalTotal,
    goalDone: MOCK_DATA.goalDone,
    goalFlags: [],               // [{done: true/false}, ...]

    // 打卡
    streakDays: MOCK_DATA.streakDays,

    // 错词
    wrongCount: MOCK_DATA.wrongCount,
    eveningUnlocked: MOCK_DATA.eveningUnlocked,

    // 安全区
    statusBarHeight: 0,
    safeAreaBottom: 0
  },

  onLoad() {
    this._initSafeArea();
    this._initProgress();
    this._initGoalFlags();
  },

  // --------------------------------------------------
  // 初始化：安全区高度
  // --------------------------------------------------
  _initSafeArea() {
    try {
      const info = wx.getSystemInfoSync();
      const statusBarHeight = info.statusBarHeight || 0;
      // safeAreaBottom: 距屏幕底部的安全内边距（Home Indicator 高度）
      const safeAreaBottom = info.screenHeight - (info.safeArea ? info.safeArea.bottom : info.screenHeight);
      this.setData({
        statusBarHeight,
        safeAreaBottom
      });
    } catch (e) {
      // 降级处理
      this.setData({ statusBarHeight: 44, safeAreaBottom: 34 });
    }
  },

  // --------------------------------------------------
  // 初始化：进度条数据
  // --------------------------------------------------
  _initProgress() {
    const { bookLearned, bookTotal } = this.data;
    const ratio = bookTotal > 0 ? bookLearned / bookTotal : 0;
    const percent = Math.round(ratio * 100);
    this.setData({
      progressPercent: percent + '%',
      progressWidth: percent + '%'
    });
  },

  // --------------------------------------------------
  // 初始化：今日目标旗帜
  // --------------------------------------------------
  _initGoalFlags() {
    const { goalTotal, goalDone } = this.data;
    const flags = [];
    for (let i = 0; i < goalTotal; i++) {
      flags.push({ done: i < goalDone });
    }
    this.setData({ goalFlags: flags });
  },

  // --------------------------------------------------
  // 视图切换
  // --------------------------------------------------
  onTabTap(e) {
    const view = e.currentTarget.dataset.view;
    if (view && view !== this.data.currentView) {
      this.setData({ currentView: view });
    }
  },

  // --------------------------------------------------
  // CTA: 继续学习
  // --------------------------------------------------
  onContinueTap() {
    wx.showToast({
      title: '进入学习（待实现）',
      icon: 'none'
    });
  },

  // --------------------------------------------------
  // 错词区域点击
  // --------------------------------------------------
  onWrongWordsTap() {
    wx.showToast({
      title: '进入错词复习（待实现）',
      icon: 'none'
    });
  },

  // --------------------------------------------------
  // 书名下拉（切换单词书）
  // --------------------------------------------------
  onBookSelectorTap() {
    wx.showToast({
      title: '切换单词书（待实现）',
      icon: 'none'
    });
  }
});
