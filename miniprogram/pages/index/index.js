Page({
  data: {
    message: "诊断页已启动",
    time: ""
  },

  onLoad() {
    this.setData({
      time: new Date().toLocaleTimeString()
    });
  }
});
