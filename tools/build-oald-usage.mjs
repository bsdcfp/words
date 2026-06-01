import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const Mdict = require("mdict-js").default;
const cheerio = require("cheerio");

const defaultMdxPath = "/Users/fuping.chu/Documents/Personal/学习力/单词/牛津高阶（第10版 英汉双解） V11_8.mdx";
const mdxPath = process.env.OALD_MDX_PATH || defaultMdxPath;
const ownedDatasetPath = new URL("../data/gaokao-3500-owned.json", import.meta.url);
const usageOutputPath = new URL("../data/oald-usage.json", import.meta.url);
const reportOutputPath = new URL("../data/oald-usage-report.json", import.meta.url);

const ownedDataset = JSON.parse(await readFile(ownedDatasetPath, "utf8"));
const dict = new Mdict(mdxPath, { stripKey: false, keyCaseSensitive: true });
const usageByWordId = {};
const report = {
  generatedAt: new Date().toISOString(),
  source: {
    dictionary: "Oxford Advanced Learner's Dictionary 10th bilingual MDX",
    mdxPath,
    license: "user-provided authorized database"
  },
  totals: {
    learningItems: ownedDataset.words.length,
    matchedEntries: 0,
    usageItems: 0,
    examples: 0,
    aiFallbackExamples: 0,
    itemsWithAnyExample: 0,
    collocationItems: 0,
    missingEntries: 0,
    noUsableUsage: 0
  },
  samples: {},
  misses: []
};

for (const word of ownedDataset.words) {
  const entries = lookupEntries(word);
  if (!entries.length) {
    report.totals.missingEntries += 1;
    rememberMiss(word, "missing_entry");
    addFallbackUsage(word, "missing_entry");
    continue;
  }
  report.totals.matchedEntries += 1;
  let usage = null;
  for (const entry of entries) {
    usage = extractUsage(word, entry.definition);
    if (usage) break;
  }
  if (!usage) {
    report.totals.noUsableUsage += 1;
    rememberMiss(word, "no_usable_usage");
    addFallbackUsage(word, "no_oald_example");
    continue;
  }
  usageByWordId[word.id] = usage;
  report.totals.usageItems += 1;
  if (usage.example) {
    report.totals.examples += 1;
    report.totals.itemsWithAnyExample += 1;
  }
  report.totals.collocationItems += usage.collocations ? usage.collocations.length : 0;
  if (["absolutely", "acquire", "account", "accident"].includes(word.word)) {
    report.samples[word.id] = {
      word: word.word,
      pos: word.pos,
      cn: word.cn,
      senseCn: usage.selection.senseCn,
      senseScore: usage.selection.senseScore,
      collocationCount: usage.collocations.length,
      hasExample: Boolean(usage.example)
    };
  }
}

await writeFile(
  usageOutputPath,
  `${JSON.stringify(
    {
      meta: report.source,
      usageByWordId
    },
    null,
    2
  )}\n`
);

await writeFile(reportOutputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`OALD usage items: ${report.totals.usageItems}/${report.totals.learningItems}`);
console.log(`Examples: ${report.totals.examples}; AI fallbacks: ${report.totals.aiFallbackExamples}; collocations: ${report.totals.collocationItems}`);

function addFallbackUsage(word, reason) {
  const aiFallback = buildAiFallbackExample(word, reason);
  usageByWordId[word.id] = {
    collocations: [],
    aiFallback,
    selection: {
      source: "ai_fallback_seeded_by_gaokao_word",
      selectedBy: "rule_ai_fallback_v1",
      senseCn: word.cn.join("，"),
      senseEn: "",
      senseScore: 0
    }
  };
  report.totals.usageItems += 1;
  report.totals.aiFallbackExamples += 1;
  report.totals.itemsWithAnyExample += 1;
}

function buildAiFallbackExample(word, reason) {
  const display = cleanDisplayWord(word.word || word.lemma || "");
  const lower = display.toLowerCase();
  const example = specialFallbackExample(lower) || genericFallbackExample(display, word);
  return {
    en: example.en,
    cn: example.cn,
    contentType: "ai_fallback",
    source: "ai_generated_seeded_by_gaokao_word",
    sourceBatch: "oald10_gap_fallback_v1",
    translationSource: "ai",
    selectedBy: reason,
    reviewStatus: "needs_review"
  };
}

function genericFallbackExample(display, word) {
  const phrase = nounPhrase(display);
  const meaning = word.cn[0] || "这个词";
  const pos = word.pos.toLowerCase();
  if (pos.includes("num")) {
    return {
      en: `There are ${display} students in the room.`,
      cn: `房间里有${meaning}个学生。`
    };
  }
  if (pos.includes("pron")) {
    return {
      en: `${capitalize(display)} are the books I borrowed yesterday.`,
      cn: `${meaning}是我昨天借的书。`
    };
  }
  if (pos.includes("adj")) {
    return {
      en: `The teacher showed us a ${display} example.`,
      cn: `老师给我们看了一个${meaning}的例子。`
    };
  }
  if (pos.includes("v")) {
    return {
      en: `Please ${display} the sentence carefully.`,
      cn: `请认真${meaning}这个句子。`
    };
  }
  if (isProperPlace(display)) {
    return {
      en: `${display} is marked on the map in our classroom.`,
      cn: `${meaning}标在我们教室的地图上。`
    };
  }
  return {
    en: `I saw ${phrase} in the picture.`,
    cn: `我在图片里看到了${meaning}。`
  };
}

function specialFallbackExample(lower) {
  return {
  africa: { en: "Africa is the second largest continent in the world.", cn: "非洲是世界第二大洲。" },
  african: { en: "The film shows African music and dance.", cn: "这部电影展示了非洲音乐和舞蹈。" },
  america: { en: "America is across the Pacific Ocean from China.", cn: "美国在中国隔太平洋的另一边。" },
  american: { en: "An American student joined our class today.", cn: "一名美国学生今天加入了我们班。" },
  asia: { en: "China is in Asia.", cn: "中国在亚洲。" },
  astronomy: { en: "She is interested in astronomy.", cn: "她对天文学感兴趣。" },
  atlantic: { en: "The ship crossed the Atlantic.", cn: "那艘船横渡了大西洋。" },
  australian: { en: "An Australian friend visited our school.", cn: "一位澳大利亚朋友参观了我们学校。" },
  badminton: { en: "We play badminton after school.", cn: "我们放学后打羽毛球。" },
  bakery: { en: "There is a bakery near the school.", cn: "学校附近有一家面包店。" },
  blouse: { en: "She wore a white blouse to the party.", cn: "她穿了一件白色女衬衫去参加聚会。" },
  britain: { en: "Britain is an island country in Europe.", cn: "英国是欧洲的一个岛国。" },
  businesswoman: { en: "The businesswoman gave a speech at the meeting.", cn: "那位女企业家在会上发表了演讲。" },
  canada: { en: "Canada is famous for its forests and lakes.", cn: "加拿大以森林和湖泊闻名。" },
  canadian: { en: "The Canadian teacher speaks English and French.", cn: "那位加拿大老师会说英语和法语。" },
  canteen: { en: "We have lunch in the school canteen.", cn: "我们在学校食堂吃午饭。" },
  centimetre: { en: "The line is ten centimetres long.", cn: "这条线长十厘米。" },
  chairwoman: { en: "The chairwoman opened the meeting.", cn: "女主席宣布会议开始。" },
  chick: { en: "A yellow chick followed the hen.", cn: "一只黄色小鸡跟着母鸡。" },
  chinese: { en: "We learn Chinese history at school.", cn: "我们在学校学习中国历史。" },
  chopsticks: { en: "She can eat noodles with chopsticks.", cn: "她会用筷子吃面条。" },
  coke: { en: "He ordered a coke with his lunch.", cn: "他午饭时点了一杯可乐。" },
  consist: { en: "The team consists of six students.", cn: "这个队由六名学生组成。" },
  devote: { en: "She decided to devote more time to English.", cn: "她决定把更多时间投入英语学习。" },
  dormitory: { en: "The students live in a dormitory.", cn: "学生们住在宿舍里。" },
  england: { en: "London is the capital of England.", cn: "伦敦是英格兰的首都。" },
  englishman: { en: "The Englishman asked for a cup of tea.", cn: "那个英国男人要了一杯茶。" },
  eraser: { en: "May I borrow your eraser?", cn: "我可以借你的橡皮吗？" },
  fireworks: { en: "We watched fireworks on New Year's Eve.", cn: "我们在除夕夜看了烟花。" },
  forty: { en: "There are forty students in our class.", cn: "我们班有四十名学生。" },
  founding: { en: "The founding of the school was celebrated every year.", cn: "学校每年都会庆祝建校。" },
  france: { en: "Paris is the capital of France.", cn: "巴黎是法国的首都。" },
  french: { en: "She is learning French at school.", cn: "她在学校学法语。" },
  frenchman: { en: "The Frenchman spoke slowly and clearly.", cn: "那位法国人说得又慢又清楚。" },
  fried: { en: "He had fried eggs for breakfast.", cn: "他早餐吃了煎鸡蛋。" },
  german: { en: "My German friend is visiting Beijing.", cn: "我的德国朋友正在访问北京。" },
  germany: { en: "Germany is in Europe.", cn: "德国在欧洲。" },
  giraffe: { en: "A giraffe has a very long neck.", cn: "长颈鹿有很长的脖子。" },
  greece: { en: "Greece has many old temples.", cn: "希腊有许多古老的神庙。" },
  grocer: { en: "The grocer sells fruit and vegetables.", cn: "那位食品杂货商卖水果和蔬菜。" },
  hamburger: { en: "I ate a hamburger for lunch.", cn: "我午饭吃了一个汉堡包。" },
  housewife: { en: "The housewife prepared dinner for the family.", cn: "那位家庭主妇为家人准备了晚餐。" },
  hydrogen: { en: "Hydrogen is a very light gas.", cn: "氢是一种很轻的气体。" },
  india: { en: "India is a country in South Asia.", cn: "印度是南亚的一个国家。" },
  japan: { en: "Japan is to the east of China.", cn: "日本在中国以东。" },
  japanese: { en: "She is learning Japanese this year.", cn: "她今年在学日语。" },
  kilo: { en: "I bought a kilo of apples.", cn: "我买了一千克苹果。" },
  "kind-hearted": { en: "The kind-hearted man helped the lost child.", cn: "那个好心人帮助了迷路的孩子。" },
  lemonade: { en: "She drank a glass of lemonade.", cn: "她喝了一杯柠檬水。" },
  librarian: { en: "The librarian helped me find the book.", cn: "图书管理员帮我找到了那本书。" },
  mailbox: { en: "He put the letter in the mailbox.", cn: "他把信放进了邮箱。" },
  marxism: { en: "They discussed Marxism in history class.", cn: "他们在历史课上讨论了马克思主义。" },
  "moon cake": { en: "We eat moon cakes during the Mid-Autumn Festival.", cn: "我们在中秋节吃月饼。" },
  mutton: { en: "Mutton is popular in this restaurant.", cn: "羊肉在这家餐馆很受欢迎。" },
  nephew: { en: "My nephew is learning to ride a bike.", cn: "我的侄子正在学骑自行车。" },
  niece: { en: "Her niece drew a picture for her.", cn: "她的侄女给她画了一幅画。" },
  northeast: { en: "The town lies in the northeast of the country.", cn: "这个镇位于这个国家的东北部。" },
  ottawa: { en: "Ottawa is the capital of Canada.", cn: "渥太华是加拿大的首都。" },
  overcoat: { en: "He wore a warm overcoat in winter.", cn: "他冬天穿了一件暖和的大衣。" },
  ox: { en: "The farmer used an ox to pull the cart.", cn: "农民用一头牛拉车。" },
  pacific: { en: "The plane flew over the Pacific Ocean.", cn: "飞机飞越了太平洋。" },
  panda: { en: "The panda is eating bamboo.", cn: "熊猫正在吃竹子。" },
  paris: { en: "Paris is famous for the Eiffel Tower.", cn: "巴黎以埃菲尔铁塔闻名。" },
  parrot: { en: "The parrot can copy human speech.", cn: "鹦鹉能模仿人说话。" },
  "the north pole": { en: "The North Pole is covered with ice.", cn: "北极被冰覆盖着。" },
  postman: { en: "The postman delivered the letter this morning.", cn: "邮递员今天早上送来了那封信。" },
  punctuation: { en: "Good punctuation makes writing clearer.", cn: "好的标点能让文章更清楚。" },
  quake: { en: "The ground began to quake.", cn: "地面开始震动。" },
  radioactive: { en: "Radioactive waste must be handled carefully.", cn: "放射性废物必须小心处理。" },
  raincoat: { en: "Take a raincoat because it may rain.", cn: "带上雨衣，因为可能会下雨。" },
  receptionist: { en: "The receptionist answered the phone politely.", cn: "接待员礼貌地接了电话。" },
  retell: { en: "Please retell the story in your own words.", cn: "请用你自己的话复述这个故事。" },
  russia: { en: "Russia is a very large country.", cn: "俄罗斯是一个很大的国家。" },
  russian: { en: "He is reading a Russian novel.", cn: "他正在读一本俄国小说。" },
  safe: { en: "The money is locked in the safe.", cn: "钱锁在保险柜里。" },
  saleswoman: { en: "The saleswoman helped me choose a coat.", cn: "女售货员帮我选了一件外套。" },
  schoolmate: { en: "I met an old schoolmate on the bus.", cn: "我在公交车上遇到了一位老同学。" },
  spanish: { en: "They listened to Spanish music.", cn: "他们听了西班牙音乐。" },
  statistics: { en: "The statistics show a clear increase.", cn: "统计数字显示出明显增长。" },
  sunburnt: { en: "His face was sunburnt after the trip.", cn: "旅行后他的脸被晒黑了。" },
  "table tennis": { en: "Table tennis is popular in our school.", cn: "乒乓球在我们学校很受欢迎。" },
  tailor: { en: "The tailor made a suit for him.", cn: "裁缝给他做了一套西装。" },
  telegram: { en: "They sent a telegram to the family.", cn: "他们给家人发了一封电报。" },
  these: { en: "These are my favourite books.", cn: "这些是我最喜欢的书。" },
  thirteen: { en: "There are thirteen apples in the basket.", cn: "篮子里有十三个苹果。" },
  thirty: { en: "She waited thirty minutes for the bus.", cn: "她等公交车等了三十分钟。" },
  those: { en: "Those are the keys I lost yesterday.", cn: "那些是我昨天丢的钥匙。" },
  toothbrush: { en: "I need a new toothbrush.", cn: "我需要一把新牙刷。" },
  tortoise: { en: "The tortoise moved very slowly.", cn: "乌龟移动得很慢。" },
  twentieth: { en: "Her birthday is on the twentieth of May.", cn: "她的生日是五月二十日。" },
  twenty: { en: "Twenty people joined the club.", cn: "二十个人加入了俱乐部。" },
  videophone: { en: "They talked through a videophone.", cn: "他们通过可视电话交谈。" },
  volleyball: { en: "We played volleyball on the beach.", cn: "我们在海滩上打排球。" },
  "waiting -room": { en: "Please wait in the waiting room.", cn: "请在候诊室等候。" },
  waitress: { en: "The waitress brought us the menu.", cn: "女服务员给我们拿来了菜单。" },
  walkman: { en: "He listened to music on his Walkman.", cn: "他用随身听听音乐。" },
  watermelon: { en: "We ate watermelon after dinner.", cn: "我们晚饭后吃了西瓜。" },
  windbreaker: { en: "She wore a windbreaker on the windy day.", cn: "刮风那天她穿了一件防风夹克。" },
  yourselves: { en: "You should do the work yourselves.", cn: "你们应该自己做这项工作。" },
  zebra: { en: "A zebra has black and white stripes.", cn: "斑马有黑白条纹。" }
  }[lower];
}

function cleanDisplayWord(value) {
  return cleanText(value).replace(/\s*-\s*/g, "-").replace(/\s+/g, " ");
}

function nounPhrase(word) {
  if (!word) return "it";
  if (/^(the|some|my|your|his|her|our|their)\b/i.test(word)) return word;
  if (/s$/i.test(word) || isProperPlace(word)) return word;
  return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
}

function isProperPlace(word) {
  return /^[A-Z]/.test(word) || /^(the north pole)$/i.test(word);
}

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function lookupEntries(word) {
  const raw = word.word || word.lemma || "";
  const candidates = unique([
    raw,
    word.lemma,
    word.headword,
    ...lookupAliases(word),
    raw.toLowerCase(),
    raw.replace(/\s+/g, "-"),
    raw.replace(/\s*-\s*/g, " "),
    raw.replace(/\s*-\s*/g, "-")
  ]);
  const entries = [];
  const seenDefinitions = new Set();
  for (const candidate of candidates) {
    try {
      const result = lookupDefinition(candidate);
      if (result?.definition && !seenDefinitions.has(result.definition)) {
        entries.push(result);
        seenDefinitions.add(result.definition);
      }
    } catch (error) {
      // Some MDX keys can fail internally; continue with the next candidate.
    }
  }
  return entries;
}

function lookupDefinition(candidate, seen = new Set()) {
  if (!candidate || seen.has(candidate)) return null;
  seen.add(candidate);
  const result = dict.lookup(candidate);
  if (!result?.definition) return null;
  const linkedKey = extractMdxLink(result.definition);
  if (linkedKey && !seen.has(linkedKey)) {
    return lookupDefinition(linkedKey, seen) || result;
  }
  return result;
}

function extractMdxLink(definition) {
  const match = String(definition).match(/^@@@LINK=([^\0\r\n]+)/);
  return match?.[1]?.trim() || "";
}

function lookupAliases(word) {
  const raw = String(word.word || word.lemma || "").trim();
  const lower = raw.toLowerCase();
  const title = raw ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : "";
  const withoutParentheses = raw.replace(/\s*\([^)]*\)\s*/g, "").trim();
  const aliases = [title, withoutParentheses];
  const explicit = {
    christian: ["Christian"],
    chopsticks: ["Chopsticks", "chopstick"],
    northeast: ["north-east", "north east"],
    "waiting -room": ["waiting-room", "waiting room"],
    "waiting room": ["waiting-room", "waiting room"],
    walkman: ["Walkman", "Walkman™"],
    "atlantic ocean": ["(the) Atlantic Ocean"],
    "the atlantic ocean": ["(the) Atlantic Ocean"],
    atlantic: ["(the) Atlantic Ocean", "Atlantic Ocean"],
    bacterium: ["bacteria"],
    belongs: ["belong"],
    "easy going": ["easy-going"],
    "fruit juice": ["juice"],
    hardworking: ["hard-working"],
    "kind-hearted": ["kind-hearted", "kindhearted"],
    "jewelry": ["jewellery"],
    "judgment": ["judgement"],
    "kilometer": ["kilometre"],
    "mid-autumn": ["autumn"],
    "moon cake": ["mooncake", "moon-cake"],
    "neighborhood": ["neighbourhood"],
    "o'clock": ["clock"],
    organise: ["organize"],
    ought: ["ought to"],
    recognise: ["recognize"],
    realise: ["realize"],
    toward: ["towards"],
    traveler: ["traveller"],
    "well-known": ["well known", "well-known"]
  };
  return unique([...aliases, ...(explicit[lower] || [])]);
}

function extractUsage(word, html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const lookupNames = unique([word.word, word.lemma, word.headword, ...lookupAliases(word)]).map(normaliseLookup);
  const entries = $(".entry")
    .toArray()
    .map((entry) => ({
      entry,
      headword: cleanHeadword($(".headword", entry).first().text()),
      pos: cleanText($(".pos", entry).first().text())
    }))
    .filter((entry) => !entry.headword || lookupNames.includes(normaliseLookup(entry.headword)));
  const posMatchedEntries = entries.filter((entry) => isPosMatch(word.pos, entry.pos));
  const candidateEntries = posMatchedEntries.length ? posMatchedEntries : entries;
  const senses = candidateEntries.flatMap((entry) =>
    $(entry.entry)
      .find(".sense")
      .toArray()
      .map((sense) => buildSense($, sense, word, entry))
  );
  const usableSenses = senses.filter((sense) => sense.senseCn || sense.examples.length || sense.collocations.length);
  if (!usableSenses.length) return null;
  const selected = selectBestSense(usableSenses);
  const collocations = selected.collocations.slice(0, 3);
  const example = selectBestExample(selected.examples, word) || selectBestExample(collectEntryExamples($, candidateEntries), word);
  if (!collocations.length && !example) return null;
  return {
    collocations,
    example,
    selection: {
      source: "oald10_mdx",
      selectedBy: "rule_sense_match_v1",
      senseCn: selected.senseCn,
      senseEn: selected.senseEn,
      senseScore: selected.senseScore
    }
  };
}

function selectBestSense(senses) {
  const withExamples = senses.filter((sense) => sense.examples.length);
  const withUsage = withExamples.length ? withExamples : senses.filter((sense) => sense.collocations.length);
  const candidates = withUsage.length ? withUsage : senses;
  return candidates.sort((a, b) => b.senseScore - a.senseScore || b.examples.length - a.examples.length)[0];
}

function buildSense($, sense, word, entry) {
  const senseNode = $(sense);
  const senseEn = cleanText(senseNode.find(".def").first().text());
  const senseCn = cleanText(senseNode.find("deft chn").first().text());
  const examples = uniqueExamples(senseNode
    .find("ul.examples li, .x-g")
    .toArray()
    .map((item) => buildExample($, item))
    .filter(Boolean));
  const collocations = uniqueCollocations([
    ...examples.flatMap((example) => example.highlighted)
  ]).map((text) => ({
    text,
    cn: "",
    contentType: "dictionary",
    source: "oald10_mdx",
    sourceBatch: "oald10_v11_8",
    selectedBy: "rule_sense_match_v1",
    reviewStatus: "trusted"
  }));
  return {
    entry,
    senseEn,
    senseCn,
    examples,
    collocations,
    senseScore: scoreSense(word.cn, senseCn, senseEn)
  };
}

function collectEntryExamples($, entries) {
  return uniqueExamples(
    entries.flatMap((entry) =>
      $(entry.entry)
        .find("ul.examples li, .x-g")
        .toArray()
        .map((item) => buildExample($, item))
        .filter(Boolean)
    )
  );
}

function buildExample($, item) {
  const node = $(item);
  const en = cleanText(node.find(".x, .unx").first().text());
  if (!en) return null;
  return {
    en,
    cn: cleanText(node.find("xt chn, at chn, ot chn").first().text()),
    highlighted: node
      .find(".x .cl")
      .toArray()
      .map((highlight) => cleanText($(highlight).text()))
      .filter(Boolean)
  };
}

function uniqueExamples(examples) {
  const seen = new Set();
  return examples.filter((example) => {
    const key = normaliseWhitespace(example.en).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectBestExample(examples, word) {
  if (!examples.length) return null;
  const selected = examples
    .map((example) => ({ example, score: scoreExample(example, word) }))
    .sort((a, b) => b.score - a.score)[0].example;
  return {
    en: selected.en,
    cn: selected.cn,
    contentType: "dictionary",
    source: "oald10_mdx",
    sourceBatch: "oald10_v11_8",
    translationSource: selected.cn ? "dictionary" : "",
    selectedBy: "rule_sense_match_v1",
    reviewStatus: "trusted"
  };
}

function scoreSense(targetCn, senseCn, senseEn) {
  const target = targetCn.join("");
  const targetTokens = targetCn.flatMap(splitMeaning);
  const sense = `${senseCn}${senseEn}`;
  let score = 0;
  for (const token of targetTokens) {
    if (token && sense.includes(token)) score += 8 + Math.min(token.length, 4);
  }
  score += overlapChars(target, senseCn).length;
  if (senseCn) score += 1;
  return score;
}

function scoreExample(example, word) {
  const words = example.en.split(/\s+/).filter(Boolean).length;
  let score = 0;
  if (example.cn) score += 3;
  if (/[.!?]$/.test(example.en)) score += 3;
  if (words >= 5 && words <= 16) score += 3;
  if (words > 0 && words < 5) score -= 1;
  if (example.highlighted.length) score += 2;
  if (example.en.toLowerCase().includes(word.word.toLowerCase())) score += 2;
  return score;
}

function uniqueCollocations(items) {
  return unique(
    items
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter((item) => item && item.length <= 80)
      .filter((item) => !/^[a-z]$/i.test(item))
      .filter(isPhraseLikeCollocation)
  );
}

function isPhraseLikeCollocation(text) {
  return /[\s/-]/.test(text);
}

function isPosMatch(localPos, dictionaryPos) {
  const expected = posAliases(localPos);
  if (!expected.length) return true;
  return expected.includes(dictionaryPos.toLowerCase());
}

function posAliases(pos) {
  const value = pos.toLowerCase();
  if (value.includes("adv")) return ["adverb"];
  if (value.includes("adj")) return ["adjective"];
  if (value.includes("prep")) return ["preposition"];
  if (value.includes("conj")) return ["conjunction"];
  if (value.includes("pron")) return ["pronoun"];
  if (value.includes("num")) return ["number"];
  if (value.includes("n.")) return ["noun"];
  if (value.includes("v")) return ["verb"];
  return [];
}

function splitMeaning(text) {
  return text
    .split(/[，,；;、（）()]/)
    .map((item) => item.replace(/[的地得了和与或及其是为把被可能使将已很]/g, "").trim())
    .filter((item) => item.length >= 1);
}

function overlapChars(a, b) {
  const chars = new Set((a || "").replace(/[，,；;、（）()\s]/g, "").split(""));
  return [...new Set((b || "").replace(/[，,；;、（）()\s]/g, "").split(""))].filter((char) => chars.has(char));
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanHeadword(value) {
  return cleanText(value).replace(/\d+$/, "").replace(/™$/, "");
}

function normaliseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normaliseLookup(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function rememberMiss(word, reason) {
  if (report.misses.length >= 80) return;
  report.misses.push({
    id: word.id,
    word: word.word,
    pos: word.pos,
    cn: word.cn,
    reason
  });
}
