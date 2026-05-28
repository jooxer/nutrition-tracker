// 营养成分表 OCR 解析
// 优先使用浏览器原生 OCR（Chrome 的 ImageCapture/Shape Detection 不含 OCR），
// 退回到动态加载 tesseract.js（按需加载，不进主 bundle）

export interface NutritionFacts {
  carb: number;
  protein: number;
  fat: number;
  per?: string;
  name?: string;
}

const GEMINI_MODEL = 'gemini-1.5-flash';

function getGeminiKey(): string {
  return localStorage.getItem('nutrition-tracker:geminiKey') || import.meta.env.VITE_GEMINI_API_KEY || '';
}

export function hasGeminiKey(): boolean {
  return !!getGeminiKey();
}

export async function recognizeNutritionLabel(imageDataUrl: string): Promise<NutritionFacts | null> {
  const key = getGeminiKey();
  if (!key) {
    return fallbackOcr(imageDataUrl);
  }
  return geminiExtract(imageDataUrl, key);
}

async function geminiExtract(imageDataUrl: string, apiKey: string): Promise<NutritionFacts | null> {
  const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const mimeType = imageDataUrl.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';

  const body = {
    contents: [{
      parts: [
        { text: '请从这张营养成分表图片中提取以下信息，返回JSON格式：{"name":"食品名称(如果可见)","per":"每份计量(如每100g)","carb":碳水化合物克数,"protein":蛋白质克数,"fat":脂肪克数}。只返回JSON，不要其他文字。如果看不清或不是营养成分表，返回null。' },
        { inlineData: { mimeType, data: base64 } }
      ]
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let msg = `Gemini API 错误 ${res.status}`;
    if (res.status === 429) msg = 'API 配额已用完或请求过快，请稍后重试';
    else if (res.status === 400) msg = 'API Key 无效或请求格式错误';
    else if (res.status === 403) msg = 'API Key 权限不足，请检查是否启用了 Gemini API';
    if (errText) console.error('Gemini error:', errText);
    throw new Error(msg);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed === null) return null;
    return {
      carb: Number(parsed.carb) || 0,
      protein: Number(parsed.protein) || 0,
      fat: Number(parsed.fat) || 0,
      per: parsed.per || undefined,
      name: parsed.name || undefined
    };
  } catch { return null; }
}

// 正则 fallback（无 API key 时用 tesseract.js）
const PATTERNS = {
  carb: /(?:碳水化合物|碳水|糖类|carbohydrate[s]?)\s*[:：]?\s*([0-9]+\.?[0-9]*)\s*(?:g|克)/i,
  protein: /(?:蛋白质|protein[s]?)\s*[:：]?\s*([0-9]+\.?[0-9]*)\s*(?:g|克)/i,
  fat: /(?:脂肪|fat[s]?)\s*[:：]?\s*([0-9]+\.?[0-9]*)\s*(?:g|克)/i,
  per: /(?:每\s*([0-9]+\s*(?:g|克|ml|毫升)))|(?:每\s*份)|(?:per\s+([0-9]+\s*g))/i
};

async function fallbackOcr(imageDataUrl: string): Promise<NutritionFacts | null> {
  const tesseract = await import('tesseract.js');
  const worker = await tesseract.createWorker(['chi_sim', 'eng']);
  try {
    const { data } = await worker.recognize(imageDataUrl);
    const text = data.text;
    const carb = text.match(PATTERNS.carb);
    const protein = text.match(PATTERNS.protein);
    const fat = text.match(PATTERNS.fat);
    const per = text.match(PATTERNS.per);
    if (!carb && !protein && !fat) return null;
    return {
      carb: carb ? Number(carb[1]) : 0,
      protein: protein ? Number(protein[1]) : 0,
      fat: fat ? Number(fat[1]) : 0,
      per: per ? (per[1] || per[2] || '一份') : undefined
    };
  } finally {
    await worker.terminate();
  }
}

