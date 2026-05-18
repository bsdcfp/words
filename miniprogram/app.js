function configureAudioPlayback() {
  if (typeof wx === "undefined" || typeof wx.setInnerAudioOption !== "function") return;
  wx.setInnerAudioOption({
    mixWithOther: true,
    obeyMuteSwitch: false,
    speakerOn: true
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
