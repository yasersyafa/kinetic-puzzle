const fs = require('fs');

function scaleFile(file, replacer) {
  let content = fs.readFileSync(file, 'utf8');
  content = replacer(content);
  fs.writeFileSync(file, content, 'utf8');
}

// 1. Theme.ts
scaleFile('src/ui/Theme.ts', (c) => {
  return c
    .replace(/shadowOffset: 3/g, 'shadowOffset: 6')
    .replace(/borderPx: 3/g, 'borderPx: 6')
    .replace(/cornerR: 10/g, 'cornerR: 18')
    .replace(/pillCornerR: 16/g, 'pillCornerR: 32')
    .replace(/textSize \?\? 22/g, 'textSize ?? 40')
    .replace(/g\.x = 2;/g, 'g.x = 4;')
    .replace(/g\.y = 2;/g, 'g.y = 4;')
    .replace(/txt\.x = 2;/g, 'txt.x = 4;')
    .replace(/txt\.y = 2;/g, 'txt.y = 4;')
    .replace(/opts\.w \?\? 64/g, 'opts.w ?? 116')
    .replace(/opts\.h \?\? 56/g, 'opts.h ?? 100')
    .replace(/textSize \?\? 24/g, 'textSize ?? 44')
    .replace(/const spacing = 22;/g, 'const spacing = 40;')
    .replace(/g\.fillCircle\(x, y, 1\.2\);/g, 'g.fillCircle(x, y, 2.2);')
    .replace(/size: number = 28/g, 'size: number = 50')
    .replace(/y - bodyH \/ 2 \+ 4/g, 'y - bodyH / 2 + 8')
    .replace(/bodyH, 4\)/g, 'bodyH, 8)')
    .replace(/fromOffset = 40/g, 'fromOffset = 72')
    .replace(/bobAmt \?\? 6/g, 'bobAmt ?? 11')
    .replace(/lineStyle\(Math\.max\(2\.5/g, 'lineStyle(Math.max(4.5')
    .replace(/lineStyle\(3,/g, 'lineStyle(6,')
    .replace(/size \* 0\.13/g, 'size * 0.13') // Keep
});

// 2. MenuScene.ts
scaleFile('src/scenes/MenuScene.ts', (c) => {
  return c
    .replace(/titleY = 110/g, 'titleY = 200')
    .replace(/fontSize: '44px'/g, "fontSize: '80px'")
    .replace(/titleY \+ 42/g, 'titleY + 76')
    .replace(/fontSize: '14px'/g, "fontSize: '26px'")
    .replace(/cx, 240, 280, 64/g, 'cx, 430, 500, 116')
    .replace(/cx, 320, 280, 64/g, 'cx, 576, 500, 116')
    .replace(/cx, 400, 280, 64/g, 'cx, 720, 500, 116')
    .replace(/cx, 480, 200, 48/g, 'cx, 864, 360, 86')
    .replace(/\{ textSize: 18 \}/g, '{ textSize: 32 }')
    .replace(/width - 90, 36/g, 'width - 160, 64')
    .replace(/w: 140, h: 40, fill: TOKENS\.white, textSize: 14/g, 'w: 250, h: 72, fill: TOKENS.white, textSize: 26')
    .replace(/height - 24/g, 'height - 44')
    .replace(/fontSize: '12px'/g, "fontSize: '22px'")
    .replace(/pointer\.y < 80 \|\| pointer\.y > this\.scale\.height - 50/g, 'pointer.y < 144 || pointer.y > this.scale.height - 90')
    // ambient decor
    .replace(/x: 80, y: 200, size: 50/g, 'x: 144, y: 360, size: 90')
    .replace(/x: width - 80, y: 230, size: 56/g, 'x: width - 144, y: 414, size: 100')
    .replace(/x: 60, y: 380, size: 42/g, 'x: 108, y: 684, size: 76')
    .replace(/x: width - 70, y: 410, size: 48/g, 'x: width - 126, y: 738, size: 86')
    .replace(/x: 130, y: 510, size: 38/g, 'x: 234, y: 918, size: 68')
    .replace(/x: width - 130, y: 520, size: 44/g, 'x: width - 234, y: 936, size: 80')
    .replace(/x: 40, y: height - 60, size: 32/g, 'x: 72, y: height - 108, size: 58')
    .replace(/x: width - 40, y: height - 70, size: 36/g, 'x: width - 72, y: height - 126, size: 64')
    .replace(/width - 140, 110/g, 'width - 250, 200')
    .replace(/const cell = 28;/g, 'const cell = 50;')
    .replace(/x \+ 80/g, 'x + 144');
});

// 3. LevelSelectScene.ts
scaleFile('src/scenes/LevelSelectScene.ts', (c) => {
  return c
    .replace(/60, 56/g, '108, 100')
    .replace(/w: 64, h: 56, fill: TOKENS\.white, textSize: 26/g, 'w: 116, h: 100, fill: TOKENS.white, textSize: 46')
    .replace(/width \/ 2 \+ 20, 56/g, 'width / 2 + 36, 100')
    .replace(/fontSize: '30px'/g, "fontSize: '54px'")
    .replace(/const tile = 56;/g, 'const tile = 100;')
    .replace(/const gapX = 14;/g, 'const gapX = 26;')
    .replace(/const gapY = 18;/g, 'const gapY = 32;')
    .replace(/startY = 130 \+ tile \/ 2/g, 'startY = 234 + tile / 2')
    .replace(/usableY = height - 100/g, 'usableY = height - 180')
    .replace(/\{ textSize: 22,/g, '{ textSize: 40,')
    .replace(/size: 22/g, 'size: 40')
    .replace(/30, y: height - 30, size: 28/g, '54, y: height - 54, size: 50')
    .replace(/width - 30, y: height - 40, size: 32/g, 'width - 54, y: height - 72, size: 58')
    .replace(/x: 36, y: 110, size: 24/g, 'x: 64, y: 200, size: 44')
    .replace(/x: width - 36, y: 110, size: 26/g, 'x: width - 64, y: 200, size: 46')
    .replace(/lineStyle\(3,/g, 'lineStyle(6,');
});

// 4. GameScene.ts
scaleFile('src/scenes/GameScene.ts', (c) => {
  return c
    .replace(/const headerY = 36;/g, 'const headerY = 64;')
    .replace(/drawHudLabel\(64, headerY, 96, 48,/g, 'drawHudLabel(116, headerY, 172, 86,')
    .replace(/fontSize: '18px'/g, "fontSize: '32px'")
    .replace(/width - 64, headerY/g, 'width - 116, headerY')
    .replace(/w: 56, h: 48, fill: TOKENS\.white, textSize: 18/g, 'w: 100, h: 86, fill: TOKENS.white, textSize: 32')
    .replace(/const bottomY = this\.scale\.height - 38;/g, 'const bottomY = this.scale.height - 68;')
    .replace(/width \/ 2 - 110/g, 'width / 2 - 198')
    .replace(/width \/ 2 \+ 110/g, 'width / 2 + 198')
    .replace(/, 96, 48,/g, ', 172, 86,')
    .replace(/textSize: 16/g, 'textSize: 28')
    .replace(/cornerR - 2/g, 'cornerR - 4');
});

// 5. GameOverScene.ts
scaleFile('src/scenes/GameOverScene.ts', (c) => {
  return c
    .replace(/cy - 180/g, 'cy - 324')
    .replace(/fontSize: '52px'/g, "fontSize: '94px'")
    .replace(/cy - 120/g, 'cy - 216')
    .replace(/fontSize: '14px'/g, "fontSize: '26px'")
    .replace(/cy - 70/g, 'cy - 126')
    .replace(/fontSize: '18px'/g, "fontSize: '32px'")
    .replace(/cy \+ 10, 280, 60/g, 'cy + 18, 504, 108')
    .replace(/fontSize: '24px'/g, "fontSize: '44px'")
    .replace(/cy \+ 86, 280, 60/g, 'cy + 154, 504, 108')
    .replace(/cy \+ 162, 280, 60/g, 'cy + 290, 504, 108');
});

// 6. PauseScene.ts
scaleFile('src/scenes/PauseScene.ts', (c) => {
  return c
    .replace(/cy - 160/g, 'cy - 288')
    .replace(/fontSize: '40px'/g, "fontSize: '72px'")
    .replace(/cy - 70, 280, 60/g, 'cy - 126, 504, 108')
    .replace(/cy \+ 6, 280, 60/g, 'cy + 10, 504, 108')
    .replace(/cy \+ 82, 280, 60/g, 'cy + 148, 504, 108')
    .replace(/cy \+ 158, 280, 60/g, 'cy + 284, 504, 108');
});

// 7. TutorialScene.ts
scaleFile('src/scenes/TutorialScene.ts', (c) => {
  return c
    .replace(/const w = 640;/g, 'const w = 1152;')
    .replace(/const h = 88;/g, 'const h = 158;')
    .replace(/fontSize: '16px'/g, "fontSize: '28px'")
    .replace(/fontSize: '13px'/g, "fontSize: '24px'")
    .replace(/fontSize: '14px'/g, "fontSize: '26px'")
    .replace(/height - 90/g, 'height - 162')
    .replace(/w - 36/g, 'w - 64')
    .replace(/60, 36/g, '108, 64')
    .replace(/width \/ 2, 36/g, 'width / 2, 64')
    .replace(/w: 64, \n      h: 44,/g, 'w: 116, \n      h: 80,')
    .replace(/textSize: 22/g, 'textSize: 40')
    .replace(/width - 80, 36, 120, 40/g, 'width - 144, 64, 216, 72')
    .replace(/textSize: 14/g, 'textSize: 26')
    .replace(/lineStyle\(4/g, 'lineStyle(8')
    .replace(/lineStyle\(6/g, 'lineStyle(10')
    .replace(/lineStyle\(3/g, 'lineStyle(6')
    .replace(/const len = 60/g, 'const len = 108')
    .replace(/const headLen = 16/g, 'const headLen = 28')
    // Ghost arrow math
    .replace(/ey - 10/g, 'ey - 18').replace(/ey \+ 10/g, 'ey + 18')
    .replace(/ex - 10/g, 'ex - 18').replace(/ex \+ 10/g, 'ex + 18');
});

// 8. Block.ts
scaleFile('src/entities/Block.ts', (c) => {
  return c
    .replace(/const pxW = w \* grid\.cellSize - 8;/g, 'const pxW = w * grid.cellSize - 14;')
    .replace(/const pxH = h \* grid\.cellSize - 8;/g, 'const pxH = h * grid.cellSize - 14;')
    .replace(/lineStyle\(2, TOKENS.ink, 0\.55\);/g, 'lineStyle(4, TOKENS.ink, 0.55);')
    .replace(/const step = 10;/g, 'const step = 18;')
    .replace(/const inset = borderPx \+ 4;/g, 'const inset = borderPx + 8;');
});

// 9. Effects.ts
scaleFile('src/utils/Effects.ts', (c) => {
  return c
    .replace(/const size = 6 \+ Math\.random\(\) \* 8;/g, 'const size = 11 + Math.random() * 14;')
    .replace(/setStrokeStyle\(2,/g, 'setStrokeStyle(4,')
    .replace(/const w = 8 \+ Math\.random\(\) \* 8;/g, 'const w = 14 + Math.random() * 14;')
    .replace(/const h = 14 \+ Math\.random\(\) \* 10;/g, 'const h = 25 + Math.random() * 18;')
    .replace(/lineStyle\(5/g, 'lineStyle(9')
    .replace(/strokeCircle\(0, 0, 26\)/g, 'strokeCircle(0, 0, 46)')
    .replace(/fillCircle\(0, 0, 24\)/g, 'fillCircle(0, 0, 43)')
    .replace(/offset = \(Math\.random\(\) - 0\.5\) \* 24/g, 'offset = (Math.random() - 0.5) * 44')
    .replace(/size = 4 \+ Math\.random\(\) \* 4/g, 'size = 8 + Math.random() * 8')
    .replace(/setStrokeStyle\(1\.5/g, 'setStrokeStyle(3')
    .replace(/dist = 18 \+ Math\.random\(\) \* 22/g, 'dist = 32 + Math.random() * 40');
});

