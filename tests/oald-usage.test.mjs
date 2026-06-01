import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const usageDataset = JSON.parse(await readFile("data/oald-usage.json", "utf8"));
const report = JSON.parse(await readFile("data/oald-usage-report.json", "utf8"));
const ownedDataset = JSON.parse(await readFile("data/gaokao-3500-owned.json", "utf8"));

assert.equal(usageDataset.meta.dictionary, "Oxford Advanced Learner's Dictionary 10th bilingual MDX");
assert.ok(report.totals.usageItems > 2500, "most 3500 learning items should receive usage content");
assert.ok(report.totals.examples > 2500, "most usage items should include one selected example");
assert.equal(report.totals.itemsWithAnyExample, ownedDataset.words.length, "every learning item should have either a dictionary example or a marked AI fallback");

const entries = Object.entries(usageDataset.usageByWordId);
assert.equal(entries.length, ownedDataset.words.length, "usage dictionary should be keyed by every learning item id");

for (const [id, usage] of entries) {
  assert.ok(id.startsWith("gk3500_"), "usage ids should align with owned 3500 learning item ids");
  assert.ok(!usage.collocations || usage.collocations.length <= 3, "each item should keep at most 3 collocations");
  for (const collocation of usage.collocations || []) {
    assert.match(collocation.text, /[\s/-]/, "student-facing collocations should be phrase-like, not isolated modifier words");
  }
  if (usage.example) {
    assert.equal(usage.example.contentType, "dictionary");
    assert.equal(usage.example.reviewStatus, "trusted");
    assert.ok(usage.example.en, "dictionary example should preserve English text");
  }
  if (usage.aiFallback) {
    assert.equal(usage.aiFallback.contentType, "ai_fallback");
    assert.equal(usage.aiFallback.reviewStatus, "needs_review");
    assert.ok(usage.aiFallback.en, "AI fallback should preserve English text");
  }
}

const abandonWord = ownedDataset.words.find((word) => word.lemma === "abandon");
const abandon = usageDataset.usageByWordId[abandonWord.id];
assert.ok(abandon, "sample word abandon should have usage content");
assert.ok(abandon.example?.en, "sample word abandon should have a selected example");
assert.ok(abandon.selection?.senseCn.includes("放弃") || abandon.selection?.senseCn.includes("抛弃"));

const accountWord = ownedDataset.words.find((word) => word.lemma === "account");
const account = usageDataset.usageByWordId[accountWord.id];
assert.ok(account, "sample word account should have usage content");
assert.match(account.selection?.senseCn || "", /账目|描述|叙述|报告/);

console.log("OALD usage checks passed");
