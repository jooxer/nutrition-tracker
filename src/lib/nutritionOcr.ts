// 营养成分表 OCR 解析
// 优先使用浏览器原生 OCR（Chrome 的 ImageCapture/Shape Detection 不含 OCR），
// 退回到动态加载 tesseract.js（按需加载，不进主 bundle）

export interface NutritionFacts {
  carb: number;
  protein: number;
  fat: number;
  per?: string;       // 每 100g / 每份
  raw: string;        // 原始识别文本
}

// 中英文营养标签正则
const PATTERNS = {
  carb: /(?:碳水化合物|碳水|糖类|carbohydrate[s]?|carb[s]?)\s*[:：]?\s*([0-9]+\.?[0-9]*)\s*(?:g|克)/i,
  protein: /(?:蛋白质|protein[s]?)\s*[:：]?\s*([0-9]+\.?[0-9]*)\s*(?:g|克)/i,
  fat: /(?:脂肪|fat[s]?)\s*[:：]?\s*([0-9]+\.?[0-9]*)\s*(?:g|克)/i,
  per: /(?:每\s*([0-9]+\s*(?:g|克|ml|毫升)))|(?:每\s*份)|(?:per\s+([0-9]+\s*g))/i
};

export function parseNutritionText(text: string): NutritionFacts | null {
  const carb = text.match(PATTERNS.carb);
  const protein = text.match(PATTERNS.protein);
  const fat = text.match(PATTERNS.fat);
  const per = text.match(PATTERNS.per);
  if (!carb && !protein && !fat) return null;
  return {
    carb: carb ? Number(carb[1]) : 0,
    protein: protein ? Number(protein[1]) : 0,
    fat: fat ? Number(fat[1]) : 0,
    per: per ? (per[1] || per[2] || '一份') : undefined,
    raw: text
  };
}

// 动态加载 tesseract.js 进行 OCR
export async function ocrImage(imageDataUrl: string): Promise<string> {
  const tesseract = await import('tesseract.js');
  const worker = await tesseract.createWorker(['chi_sim', 'eng']);
  try {
    const { data } = await worker.recognize(imageDataUrl);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
