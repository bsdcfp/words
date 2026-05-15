import assert from "node:assert/strict";
import { getRewardStreakText } from "../src/report.js";

assert.equal(getRewardStreakText({ user: { streakDays: 4, longestStreak: 9 } }), "连续打卡 4 天");
assert.equal(getRewardStreakText({ user: { streakDays: 0, longestStreak: 9 } }), "最长连续打卡 9 天");
assert.equal(getRewardStreakText({ user: { streakDays: 0, longestStreak: 0 } }), "最长连续打卡 0 天");
