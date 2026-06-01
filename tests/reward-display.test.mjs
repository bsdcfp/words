import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { getRewardStreakText } = require("../miniprogram/utils/report.js");

assert.equal(getRewardStreakText({ user: { streakDays: 4, longestStreak: 9 } }), "连续打卡 4 天");
assert.equal(getRewardStreakText({ user: { streakDays: 0, longestStreak: 9 } }), "最长连续打卡 9 天");
assert.equal(getRewardStreakText({ user: { streakDays: 0, longestStreak: 0 } }), "最长连续打卡 0 天");
