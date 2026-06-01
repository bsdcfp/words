import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dataset = JSON.parse(readFileSync(new URL("../data/gaokao-3500-owned.json", import.meta.url), "utf8"));
const words = dataset.words;

assert.ok(words.length >= 3300, "owned dataset should contain the primary-source learning items");
assert.equal(words.some((item) => item.lemma === "a"), false, "low-value article 'a' should not enter the learning core");
assert.equal(words.some((item) => item.lemma === "saw"), false, "secondary-source-only word saw should not enter the primary-source core");
assert.equal(words.every((item) => item.sourcePresence.local), true, "owned core should only contain words found in the primary doc");

const aboutItems = words.filter((item) => item.lemma === "about");
assert.deepEqual(aboutItems.map((item) => item.posKey).sort(), ["adv"], "about should follow the primary doc POS");

const aboveItems = words.filter((item) => item.lemma === "above");
assert.deepEqual(aboveItems.map((item) => item.posKey).sort(), ["prep"], "above should follow the primary doc POS");

const accuse = words.find((item) => item.lemma === "accuse" && item.posKey === "v");
assert.ok(accuse, "accuse v. should exist");
assert.deepEqual(accuse.cn, ["控告"], "accuse should use the primary doc meaning");
assert.equal(accuse.definitionSource, "local_order_pdf", "accuse should come from the primary doc");

const accessItems = words.filter((item) => item.lemma === "access");
assert.deepEqual(accessItems.map((item) => item.posKey), ["n"], "access should follow the primary doc POS");
