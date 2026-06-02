// Figma Plugin Script: 05-home-normal (Dark theme)
// Usage: Open Figma → Plugins → Development → Open console → paste & run
// Based on: docs/design-outputs/page-specs/05-home-normal-spec.md

// Helper: hex to Figma RGB (0-1 range)
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255
  };
}

function solidFill(hex, opacity = 1) {
  return [{ type: 'SOLID', color: hexToRgb(hex), opacity }];
}

function solidStroke(hex, opacity = 1) {
  return [{ type: 'SOLID', color: hexToRgb(hex), opacity }];
}

async function main() {
  // Load fonts
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Extra Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Black" });

  // === iPhone 15 Pro frame (390x844 @1x) ===
  const page = figma.currentPage;
  const phone = figma.createFrame();
  phone.name = "05-home-normal-dark";
  phone.resize(390, 844);
  phone.fills = solidFill('#0B1A17');
  phone.clipsContent = true;
  phone.layoutMode = 'VERTICAL';
  phone.primaryAxisAlignItems = 'MIN';
  phone.counterAxisAlignItems = 'CENTER';
  phone.paddingLeft = 0;
  phone.paddingRight = 0;
  phone.paddingTop = 0;
  phone.paddingBottom = 0;
  phone.itemSpacing = 0;

  // === Status Bar (54px) ===
  const statusBar = figma.createFrame();
  statusBar.name = "StatusBar";
  statusBar.resize(390, 54);
  statusBar.fills = [];
  statusBar.layoutMode = 'HORIZONTAL';
  statusBar.primaryAxisAlignItems = 'SPACE_BETWEEN';
  statusBar.counterAxisAlignItems = 'CENTER';
  statusBar.paddingLeft = 16;
  statusBar.paddingRight = 16;
  statusBar.paddingTop = 14;
  statusBar.paddingBottom = 8;

  const timeText = figma.createText();
  timeText.characters = "9:41";
  timeText.fontSize = 16;
  timeText.fontName = { family: "Inter", style: "Semi Bold" };
  timeText.fills = solidFill('#FFF9EF');
  statusBar.appendChild(timeText);

  const iconsText = figma.createText();
  iconsText.characters = "···";
  iconsText.fontSize = 14;
  iconsText.fills = solidFill('#FFF9EF', 0.6);
  statusBar.appendChild(iconsText);

  phone.appendChild(statusBar);

  // === Top Nav Bar (44px) ===
  const navBar = figma.createFrame();
  navBar.name = "TopNav";
  navBar.resize(390, 44);
  navBar.fills = [];
  navBar.layoutMode = 'HORIZONTAL';
  navBar.primaryAxisAlignItems = 'SPACE_BETWEEN';
  navBar.counterAxisAlignItems = 'CENTER';
  navBar.paddingLeft = 20;
  navBar.paddingRight = 20;

  // Book icon placeholder
  const bookIcon = figma.createRectangle();
  bookIcon.name = "BookIcon";
  bookIcon.resize(28, 22);
  bookIcon.cornerRadius = 4;
  bookIcon.fills = solidFill('#24413E');

  const bookName = figma.createText();
  bookName.characters = "高考课标 3500 ⌄";
  bookName.fontSize = 15;
  bookName.fontName = { family: "Inter", style: "Bold" };
  bookName.fills = solidFill('#FFF9EF');

  const navLeft = figma.createFrame();
  navLeft.name = "NavLeft";
  navLeft.layoutMode = 'HORIZONTAL';
  navLeft.counterAxisAlignItems = 'CENTER';
  navLeft.itemSpacing = 8;
  navLeft.fills = [];
  navLeft.counterAxisSizingMode = 'AUTO';
  navLeft.primaryAxisSizingMode = 'AUTO';
  navLeft.appendChild(bookIcon);
  navLeft.appendChild(bookName);

  // Streak
  const streakDot = figma.createEllipse();
  streakDot.name = "StreakDot";
  streakDot.resize(10, 10);
  streakDot.fills = solidFill('#D97757');

  const streakText = figma.createText();
  streakText.characters = "连续 3 天";
  streakText.fontSize = 13;
  streakText.fontName = { family: "Inter", style: "Semi Bold" };
  streakText.fills = solidFill('#D97757');

  const navRight = figma.createFrame();
  navRight.name = "NavRight";
  navRight.layoutMode = 'HORIZONTAL';
  navRight.counterAxisAlignItems = 'CENTER';
  navRight.itemSpacing = 5;
  navRight.fills = [];
  navRight.counterAxisSizingMode = 'AUTO';
  navRight.primaryAxisSizingMode = 'AUTO';
  navRight.appendChild(streakDot);
  navRight.appendChild(streakText);

  navBar.appendChild(navLeft);
  navBar.appendChild(navRight);
  phone.appendChild(navBar);

  // === Spacer 16px ===
  const spacer1 = figma.createFrame();
  spacer1.name = "Spacer-16";
  spacer1.resize(390, 16);
  spacer1.fills = [];
  phone.appendChild(spacer1);

  // === Book Progress Card ===
  const progressCard = figma.createFrame();
  progressCard.name = "BookProgressCard";
  progressCard.resize(335, 170);
  progressCard.cornerRadius = 20;
  progressCard.fills = [{ type: 'SOLID', color: hexToRgb('#132822'), opacity: 0.85 }];
  progressCard.strokes = solidStroke('#24413E');
  progressCard.strokeWeight = 1;
  progressCard.layoutMode = 'VERTICAL';
  progressCard.paddingLeft = 24;
  progressCard.paddingRight = 24;
  progressCard.paddingTop = 24;
  progressCard.paddingBottom = 24;
  progressCard.itemSpacing = 8;
  progressCard.counterAxisAlignItems = 'MIN';

  const labelText = figma.createText();
  labelText.characters = "单词书进度";
  labelText.fontSize = 12;
  labelText.fontName = { family: "Inter", style: "Semi Bold" };
  labelText.fills = solidFill('#5E8A7A');
  labelText.letterSpacing = { value: 1, unit: 'PIXELS' };
  progressCard.appendChild(labelText);

  const titleText = figma.createText();
  titleText.characters = "高考课标 3500";
  titleText.fontSize = 22;
  titleText.fontName = { family: "Inter", style: "Black" };
  titleText.fills = solidFill('#FFF9EF');
  progressCard.appendChild(titleText);

  // Progress row
  const progressRow = figma.createFrame();
  progressRow.name = "ProgressRow";
  progressRow.resize(287, 24);
  progressRow.fills = [];
  progressRow.layoutMode = 'HORIZONTAL';
  progressRow.primaryAxisAlignItems = 'SPACE_BETWEEN';
  progressRow.counterAxisAlignItems = 'CENTER';

  const numText = figma.createText();
  numText.characters = "120 / 3500";
  numText.fontSize = 17;
  numText.fontName = { family: "Inter", style: "Black" };
  numText.fills = solidFill('#FFF9EF');

  const pctText = figma.createText();
  pctText.characters = "3%";
  pctText.fontSize = 14;
  pctText.fontName = { family: "Inter", style: "Bold" };
  pctText.fills = solidFill('#5E8A7A');

  progressRow.appendChild(numText);
  progressRow.appendChild(pctText);
  progressCard.appendChild(progressRow);

  // Progress bar
  const barTrack = figma.createFrame();
  barTrack.name = "ProgressBarTrack";
  barTrack.resize(287, 6);
  barTrack.cornerRadius = 3;
  barTrack.fills = solidFill('#1E3D34');
  barTrack.clipsContent = true;

  const barFill = figma.createRectangle();
  barFill.name = "ProgressBarFill";
  barFill.resize(10, 6);
  barFill.cornerRadius = 3;
  barFill.fills = solidFill('#D97757');
  barTrack.appendChild(barFill);

  progressCard.appendChild(barTrack);

  phone.appendChild(progressCard);

  // === Spacer 12px ===
  const spacer2 = figma.createFrame();
  spacer2.name = "Spacer-12";
  spacer2.resize(390, 12);
  spacer2.fills = [];
  phone.appendChild(spacer2);

  // === Today Goal Card ===
  const goalCard = figma.createFrame();
  goalCard.name = "TodayGoalCard";
  goalCard.resize(335, 200);
  goalCard.cornerRadius = 20;
  goalCard.fills = [{ type: 'SOLID', color: hexToRgb('#132822'), opacity: 0.85 }];
  goalCard.strokes = solidStroke('#24413E');
  goalCard.strokeWeight = 1;
  goalCard.layoutMode = 'VERTICAL';
  goalCard.paddingLeft = 24;
  goalCard.paddingRight = 24;
  goalCard.paddingTop = 24;
  goalCard.paddingBottom = 24;
  goalCard.itemSpacing = 12;

  const goalLabel = figma.createText();
  goalLabel.characters = "○ 今日目标";
  goalLabel.fontSize = 13;
  goalLabel.fontName = { family: "Inter", style: "Semi Bold" };
  goalLabel.fills = solidFill('#5E8A7A');
  goalCard.appendChild(goalLabel);

  // Big number row
  const goalNumRow = figma.createFrame();
  goalNumRow.name = "GoalNumber";
  goalNumRow.fills = [];
  goalNumRow.layoutMode = 'HORIZONTAL';
  goalNumRow.counterAxisAlignItems = 'MAX';
  goalNumRow.itemSpacing = 4;
  goalNumRow.counterAxisSizingMode = 'AUTO';
  goalNumRow.primaryAxisSizingMode = 'AUTO';

  const bigNum = figma.createText();
  bigNum.characters = "4";
  bigNum.fontSize = 48;
  bigNum.fontName = { family: "Inter", style: "Black" };
  bigNum.fills = solidFill('#FFF9EF');

  const unitText = figma.createText();
  unitText.characters = "个 List";
  unitText.fontSize = 20;
  unitText.fontName = { family: "Inter", style: "Bold" };
  unitText.fills = solidFill('#A9B7B2');

  goalNumRow.appendChild(bigNum);
  goalNumRow.appendChild(unitText);
  goalCard.appendChild(goalNumRow);

  // Flags row
  const flagsRow = figma.createFrame();
  flagsRow.name = "Flags";
  flagsRow.fills = [];
  flagsRow.layoutMode = 'HORIZONTAL';
  flagsRow.itemSpacing = 20;
  flagsRow.counterAxisSizingMode = 'AUTO';
  flagsRow.primaryAxisSizingMode = 'AUTO';

  for (let i = 0; i < 4; i++) {
    const flag = figma.createRectangle();
    flag.name = i < 2 ? "FlagDone" : "FlagPending";
    flag.resize(10, 16);
    flag.fills = solidFill('#5E8A7A', i < 2 ? 1 : 0.3);
    flagsRow.appendChild(flag);
  }
  goalCard.appendChild(flagsRow);

  // CTA Button
  const ctaBtn = figma.createFrame();
  ctaBtn.name = "CTA-Continue";
  ctaBtn.resize(287, 44);
  ctaBtn.cornerRadius = 12;
  ctaBtn.fills = solidFill('#D97757');
  ctaBtn.layoutMode = 'HORIZONTAL';
  ctaBtn.primaryAxisAlignItems = 'CENTER';
  ctaBtn.counterAxisAlignItems = 'CENTER';
  ctaBtn.effects = [{
    type: 'DROP_SHADOW',
    color: { r: 0.85, g: 0.47, b: 0.34, a: 0.25 },
    offset: { x: 0, y: 8 },
    radius: 24,
    spread: 0,
    visible: true,
    blendMode: 'NORMAL'
  }];

  const ctaText = figma.createText();
  ctaText.characters = "继续";
  ctaText.fontSize = 16;
  ctaText.fontName = { family: "Inter", style: "Black" };
  ctaText.fills = solidFill('#141413');
  ctaBtn.appendChild(ctaText);

  goalCard.appendChild(ctaBtn);
  phone.appendChild(goalCard);

  // === Spacer 12px ===
  const spacer3 = figma.createFrame();
  spacer3.name = "Spacer-12";
  spacer3.resize(390, 12);
  spacer3.fills = [];
  phone.appendChild(spacer3);

  // === Wrong Words Hint Bar ===
  const hintBar = figma.createFrame();
  hintBar.name = "WrongWordHint";
  hintBar.resize(335, 48);
  hintBar.cornerRadius = 14;
  hintBar.fills = solidFill('#1E3D34');
  hintBar.strokes = solidStroke('#24413E');
  hintBar.strokeWeight = 1;
  hintBar.layoutMode = 'HORIZONTAL';
  hintBar.primaryAxisAlignItems = 'SPACE_BETWEEN';
  hintBar.counterAxisAlignItems = 'CENTER';
  hintBar.paddingLeft = 16;
  hintBar.paddingRight = 16;

  const hintLeft = figma.createFrame();
  hintLeft.name = "HintLeft";
  hintLeft.fills = [];
  hintLeft.layoutMode = 'HORIZONTAL';
  hintLeft.counterAxisAlignItems = 'CENTER';
  hintLeft.itemSpacing = 8;
  hintLeft.counterAxisSizingMode = 'AUTO';
  hintLeft.primaryAxisSizingMode = 'AUTO';

  const hintIcon = figma.createEllipse();
  hintIcon.resize(20, 20);
  hintIcon.fills = [];
  hintIcon.strokes = solidStroke('#D97757');
  hintIcon.strokeWeight = 1.5;

  const hintText = figma.createText();
  hintText.characters = "✕ 8 个错词待复习";
  hintText.fontSize = 13;
  hintText.fontName = { family: "Inter", style: "Bold" };
  hintText.fills = solidFill('#A9B7B2');

  hintLeft.appendChild(hintIcon);
  hintLeft.appendChild(hintText);

  const hintTime = figma.createText();
  hintTime.characters = "晚间入口已开启";
  hintTime.fontSize = 11;
  hintTime.fontName = { family: "Inter", style: "Semi Bold" };
  hintTime.fills = solidFill('#5E8A7A');

  hintBar.appendChild(hintLeft);
  hintBar.appendChild(hintTime);
  phone.appendChild(hintBar);

  // === Bottom spacer (scene area placeholder) ===
  const sceneSpacer = figma.createFrame();
  sceneSpacer.name = "ScenePlaceholder";
  sceneSpacer.resize(390, 140);
  sceneSpacer.fills = [];
  phone.appendChild(sceneSpacer);

  // === Tab Bar ===
  const tabBar = figma.createFrame();
  tabBar.name = "TabBar";
  tabBar.resize(390, 64);
  tabBar.fills = [{ type: 'SOLID', color: hexToRgb('#0A1613'), opacity: 0.96 }];
  tabBar.layoutMode = 'HORIZONTAL';
  tabBar.counterAxisAlignItems = 'CENTER';

  // Divider line
  tabBar.strokes = solidStroke('#1E3D34');
  tabBar.strokeWeight = 0.5;
  tabBar.strokeAlign = 'INSIDE';

  // Tab 1: 单词 (active)
  const tab1 = figma.createFrame();
  tab1.name = "Tab-Words-Active";
  tab1.resize(195, 50);
  tab1.fills = [];
  tab1.layoutMode = 'VERTICAL';
  tab1.primaryAxisAlignItems = 'CENTER';
  tab1.counterAxisAlignItems = 'CENTER';
  tab1.itemSpacing = 4;

  const tab1Icon = figma.createRectangle();
  tab1Icon.resize(18, 14);
  tab1Icon.cornerRadius = 3;
  tab1Icon.fills = solidFill('#D97757');

  const tab1Label = figma.createText();
  tab1Label.characters = "单词";
  tab1Label.fontSize = 10;
  tab1Label.fontName = { family: "Inter", style: "Bold" };
  tab1Label.fills = solidFill('#D97757');

  tab1.appendChild(tab1Icon);
  tab1.appendChild(tab1Label);

  // Tab 2: 我的 (inactive)
  const tab2 = figma.createFrame();
  tab2.name = "Tab-Profile-Inactive";
  tab2.resize(195, 50);
  tab2.fills = [];
  tab2.layoutMode = 'VERTICAL';
  tab2.primaryAxisAlignItems = 'CENTER';
  tab2.counterAxisAlignItems = 'CENTER';
  tab2.itemSpacing = 4;

  const tab2Icon = figma.createEllipse();
  tab2Icon.resize(16, 16);
  tab2Icon.fills = [];
  tab2Icon.strokes = solidStroke('#5E8A7A');
  tab2Icon.strokeWeight = 1.5;

  const tab2Label = figma.createText();
  tab2Label.characters = "我的";
  tab2Label.fontSize = 10;
  tab2Label.fontName = { family: "Inter", style: "Bold" };
  tab2Label.fills = solidFill('#5E8A7A');

  tab2.appendChild(tab2Icon);
  tab2.appendChild(tab2Label);

  tabBar.appendChild(tab1);
  tabBar.appendChild(tab2);
  phone.appendChild(tabBar);

  // Position on canvas
  phone.x = 100;
  phone.y = 100;

  // Select and zoom
  figma.currentPage.selection = [phone];
  figma.viewport.scrollAndZoomIntoView([phone]);

  figma.notify("✅ 05-home-normal (Dark) created!");
}

main();
