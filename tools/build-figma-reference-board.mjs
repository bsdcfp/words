import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoot = "docs/design-outputs/page-references-v2-imagegen";
const outputRoot = "docs/design-outputs/figma-reference-board-v2";

const pages = [
  ["01-new-user-home", "新用户首页"],
  ["02-level-select", "选择单词水平"],
  ["03-entry-assessment", "词汇量测试"],
  ["04-assessment-result", "测评结果"],
  ["05-home-normal", "学习首页"],
  ["06-pre-learning-scan", "训前检测"],
  ["07-memorize", "单词识记"],
  ["08-word-detail-modal", "详细词卡弹窗"],
  ["09-recall-before-reveal", "回忆复习-揭示前"],
  ["10-recall-after-reveal", "回忆复习-揭示后"],
  ["11-listening", "听音辨义"],
  ["12-list-complete-animation", "完成提示"],
  ["13-wrong-words", "错词本"],
  ["14-celebration", "完成页"],
  ["15-profile-settings", "我的/设置"],
  ["16-monthly-stage-test", "月度进展/阶段测"]
];

const themes = ["light", "dark"];
const pagesPerBoard = 8;

await ensureDir(outputRoot);
await cleanGeneratedSvgs(outputRoot);

for (const theme of themes) {
  const chunks = chunkPages(pages, pagesPerBoard);
  for (let index = 0; index < chunks.length; index += 1) {
    const part = index + 1;
    const svg = await buildBoard(theme, chunks[index], part, chunks.length);
    const outputPath = path.join(outputRoot, `${theme}-reference-board-part-${part}.svg`);
    await writeFile(outputPath, svg);
    console.log(outputPath);
  }
}

await writeFile(path.join(outputRoot, "README.md"), buildReadme());

async function buildBoard(theme, boardPages, part, totalParts) {
  const frameWidth = 426;
  const frameHeight = 923;
  const labelHeight = 70;
  const gap = 64;
  const columns = 4;
  const boardPadding = 80;
  const cellWidth = frameWidth + gap;
  const cellHeight = frameHeight + labelHeight + gap;
  const rows = Math.ceil(boardPages.length / columns);
  const width = boardPadding * 2 + columns * frameWidth + (columns - 1) * gap;
  const height = boardPadding * 2 + rows * (frameHeight + labelHeight) + (rows - 1) * gap;
  const bg = theme === "light" ? "#F8F3EA" : "#071216";
  const text = theme === "light" ? "#172827" : "#FFF9EF";
  const muted = theme === "light" ? "#66716D" : "#A9B7B2";
  const stroke = theme === "light" ? "#DED4C6" : "#24413E";

  const items = [];
  for (let index = 0; index < boardPages.length; index += 1) {
    const [id, title] = boardPages[index];
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = boardPadding + col * cellWidth;
    const y = boardPadding + row * cellHeight;
    const filePath = path.join(root, sourceRoot, theme, `${id}.png`);
    const base64 = (await readFile(filePath)).toString("base64");
    items.push(`
      <g id="${id}" transform="translate(${x}, ${y})">
        <rect x="-1" y="${labelHeight - 1}" width="${frameWidth + 2}" height="${frameHeight + 2}" rx="26" fill="none" stroke="${stroke}" stroke-width="2"/>
        <text x="0" y="24" font-family="PingFang SC, Arial, sans-serif" font-size="20" font-weight="700" fill="${text}">${escapeXml(id)} ${escapeXml(title)}</text>
        <text x="0" y="52" font-family="PingFang SC, Arial, sans-serif" font-size="14" fill="${muted}">Reference PNG embedded, scale 50%</text>
        <image x="0" y="${labelHeight}" width="${frameWidth}" height="${frameHeight}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${base64}"/>
      </g>
    `);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="${boardPadding}" y="42" font-family="PingFang SC, Arial, sans-serif" font-size="28" font-weight="800" fill="${text}">Word Prototype V2 ${theme} Reference Board ${part}/${totalParts}</text>
  ${items.join("\n")}
</svg>
`;
}

function buildReadme() {
  return `# Figma Reference Board V2

生成文件：

- \`light-reference-board-part-1.svg\`
- \`light-reference-board-part-2.svg\`
- \`dark-reference-board-part-1.svg\`
- \`dark-reference-board-part-2.svg\`

用法：

1. 在 Figma 里新建文件。
2. 直接拖入对应 SVG。
3. 每个页面 Reference 以 50% 比例嵌入，适合统一查看页面结构、间距、组件比例。
4. 文件已按 8 个页面一组切分，单个 SVG 控制在 20MB 以内，方便上传和导入。

注意：

- 这是 Reference Board，不是最终组件化设计稿。
- 下一步应在 Figma 中把页面拆成 token、组件和约束：背景、水墨底图、卡片、CTA、进度点、底部导航、学习流按钮、弹窗。
- 小程序实现不要继续直接对 PNG 追像素，应该对齐 Figma 中拆出的结构规格。
`;
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function cleanGeneratedSvgs(dir) {
  const entries = await readdir(dir);
  await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".svg"))
      .map((entry) => rm(path.join(dir, entry), { force: true }))
  );
}

function chunkPages(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
