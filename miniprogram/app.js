function isDevtoolsRuntime() {
  if (typeof wx === "undefined") return false;
  try {
    if (typeof wx.getDeviceInfo === "function") {
      return wx.getDeviceInfo().platform === "devtools";
    }
    if (typeof wx.getSystemInfoSync === "function") {
      return wx.getSystemInfoSync().platform === "devtools";
    }
  } catch (error) {
    // If platform detection fails, keep the normal audio setup path.
  }
  return false;
}

function configureAudioPlayback(done) {
  const finish = typeof done === "function" ? done : null;
  if (typeof wx === "undefined" || typeof wx.setInnerAudioOption !== "function") {
    if (finish) finish();
    return;
  }
  if (isDevtoolsRuntime()) {
    if (finish) finish();
    return;
  }
  let settled = false;
  let fallbackTimer = null;
  const complete = () => {
    if (settled) return;
    settled = true;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (finish) finish();
  };
  fallbackTimer = setTimeout(complete, 120);
  wx.setInnerAudioOption({
    mixWithOther: true,
    obeyMuteSwitch: false,
    speakerOn: true,
    success: complete,
    fail: complete
  });
}

App({
  onLaunch() {
    // Audio options are configured lazily before playback. Calling this during
    // app launch can trigger DevTools-level timeout logs before any audio task.
  },

  onShow() {
    // Keep startup quiet; pages call configureAudioPlayback() when they play.
  },

  configureAudioPlayback,

  globalData: {
    appName: "今日单词"
  }
});
