import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// 12×12 source matrix: 6px dots + 3px gaps = 105px artwork.
// Each 1 selects an existing dot; no points are moved off the source grid.
const gridSize = 12;
const dotDiameter = 6;
const gap = 3;
const step = dotDiameter + gap;
const sourceSize = gridSize * dotDiameter + (gridSize - 1) * gap;
// The familiar gesture cross needs an odd number of dots: five per arm and
// one centre. Its 11×11 subset stays on the 12×12 grid; only its export frame
// shifts by half a step to keep the thin cross optically centred at 24px.
const icons = {
  "storage": {
    "title": "Хранилище — полузаполненная сфера",
    "bitmap": [
      "000011110000",
      "001100001100",
      "010000000010",
      "010000000010",
      "100000000001",
      "100000000001",
      "111111111111",
      "111111111111",
      "011111111110",
      "011111111110",
      "001111111100",
      "000011110000"
    ]
  },
  "retention": {
    "title": "Срок хранения",
    "bitmap": [
      "111111111111",
      "010000000010",
      "001000000100",
      "000100001000",
      "000010010000",
      "000001100000",
      "000001100000",
      "000010010000",
      "000101101000",
      "001011110100",
      "011111111110",
      "111111111111"
    ]
  },
  "gesture": {
    "title": "Жесты — все направления и касание",
    "viewBox": "-4.5 -4.5 105 105",
    "bitmap": [
      "000001000000",
      "000001000000",
      "000001000000",
      "000001000000",
      "000001000000",
      "111111111110",
      "000001000000",
      "000001000000",
      "000001000000",
      "000001000000",
      "000001000000",
      "000000000000"
    ]
  },
  "style": {
    "title": "Стиль записи снов — звёздочки",
    "bitmap": [
      "000000000100",
      "000000000100",
      "000000011111",
      "000010000100",
      "000010000100",
      "000101000000",
      "001000100000",
      "110000011000",
      "001000100000",
      "000101000000",
      "000010000000",
      "000010000000"
    ]
  },
  "saving": {
    "title": "Характер сохранения снов",
    "bitmap": [
      "001100001100",
      "010010010010",
      "100001100001",
      "100000000001",
      "100000000001",
      "100000000001",
      "100000000001",
      "010000000010",
      "001000000100",
      "000100001000",
      "000010010000",
      "000001100000"
    ]
  },
  "matrix-12x12": {
    "title": "Матрица 12 на 12",
    "bitmap": [
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111"
    ]
  }
};

const output = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/orbit-icons');
await mkdir(output, { recursive: true });
for (const [name, { title, bitmap, viewBox }] of Object.entries(icons)) {
  if (bitmap.length !== gridSize || bitmap.some(row => !new RegExp(`^[01]{${gridSize}}$`).test(row))) {
    throw new Error(`${name}: expected ${gridSize} rows of ${gridSize} binary digits.`);
  }
  const dots = [];
  bitmap.forEach((row, y) => [...row].forEach((value, x) => {
    if (value === '1') dots.push(`    <circle cx="${dotDiameter / 2 + step * x}" cy="${dotDiameter / 2 + step * y}" r="${dotDiameter / 2}"/>`);
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="${viewBox || `0 0 ${sourceSize} ${sourceSize}`}">
  <title>${title}</title>
  <g fill="currentColor">
${dots.join('\n')}
  </g>
</svg>
`;
  await writeFile(resolve(output, `${name}.svg`), svg);
  console.log(`${name}.svg: ${dots.length} dots`);
}
