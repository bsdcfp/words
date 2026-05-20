function configureAudioPlayback(done) {
  const finish = typeof done === "function" ? done : null;
  if (typeof wx === "undefined" || typeof wx.setInnerAudioOption !== "function") {
    if (finish) finish();
    return;
  }
  wx.setInnerAudioOption({
    mixWithOther: true,
    obeyMuteSwitch: false,
    speakerOn: true,
    success: finish || undefined,
    fail: finish || undefined
  });
}

App({
  onLaunch() {
    configureAudioPlayback();
  },

  onShow() {
    configureAudioPlayback();
  },

  configureAudioPlayback,

  globalData: {
    appName: "今日单词"
  }
});
