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

type Provider = 'claude' | 'zhipu' | 'moonshot' | 'gemini';

function getApiConfig(): { provider: Provider; key: string } | null {
  const claude = localStorage.getItem('nutrition-tracker:claudeKey');
  if (claude) return { provider: 'claude', key: claude };

  const zhipu = localStorage.getItem('nutrition-tracker:zhipuKey');
  if (zhipu) return { provider: 'zhipu', key: zhipu };

  const moonshot = localStorage.getItem('nutrition-tracker:moonshotKey');
  if (moonshot) return { provider: 'moonshot', key: moonshot };

  const gemini = localStorage.getItem('nutrition-tracker:geminiKey');
  if (gemini) return { provider: 'gemini', key: gemini };

  return null;
}

export function hasApiKey(): boolean {
  return !!getApiConfig();
}

export async function recognizeNutritionLabel(imageDataUrl: string): Promise<NutritionFacts | null> {
  const config = getApiConfig();
  if (!config) return fallbackOcr(imageDataUrl);

  switch (config.provider) {
    case 'claude': return claudeExtract(imageDataUrl, config.key);
    case 'zhipu': return zhipuExtract(imageDataUrl, config.key);
    case 'moonshot': return moonshotExtract(imageDataUrl, config.key);
    case 'gemini': return geminiExtract(imageDataUrl, config.key);
  }
}

async function claudeExtract(imageDataUrl: string, apiKey: string): Promise<NutritionFacts | null> {
  const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const mimeType = imageDataUrl.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';

  const body = {
    model: 'claude-opus-4-20250514',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: '请从这张营养成分表图片中提取以下信息，返回JSON格式：{"name":"食品名称(如果可见)","per":"每份计量(如每100g)","carb":碳水化合物克数,"protein":蛋白质克数,"fat":脂肪克数}。只返回JSON，不要其他文字。如果看不清或不是营养成分表，返回null。' }
      ]
    }]
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let msg = `Claude API 错误 ${res.status}`;
    if (res.status === 401) msg = 'Claude API Key 无效';
    else if (res.status === 429) msg = 'Claude API 配额已用完';
    if (errText) console.error('Claude error:', errText);
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  return parseJsonResponse(text);
}

async function zhipuExtract(imageDataUrl: string, apiKey: string): Promise<NutritionFacts | null> {
  const body = {
    model: 'glm-4v-flash',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: '请从这张营养成分表图片中提取以下信息，返回JSON格式：{"name":"食品名称(如果可见)","per":"每份计量(如每100g)","carb":碳水化合物克数,"protein":蛋白质克数,"fat":脂肪克数}。只返回JSON，不要其他文字。如果看不清或不是营养成分表，返回null。' }
      ]
    }]
  };

  console.log('[Zhipu] Sending request to:', 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  }).catch(err => {
    console.error('[Zhipu] Fetch error:', err);
    throw err;
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let msg = `智谱 API 错误 ${res.status}`;
    if (res.status === 401) msg = '智谱 API Key 无效';
    if (errText) console.error('Zhipu error:', errText);
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return parseJsonResponse(text);
}

async function moonshotExtract(imageDataUrl: string, apiKey: string): Promise<NutritionFacts | null> {
  const body = {
    model: 'moonshot-v1-auto',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: '请从这张营养成分表图片中提取以下信息，返回JSON格式：{"name":"食品名称(如果可见)","per":"每份计量(如每100g)","carb":碳水化合物克数,"protein":蛋白质克数,"fat":脂肪克数}。只返回JSON，不要其他文字。如果看不清或不是营养成分表，返回null。' }
      ]
    }],
    max_tokens: 256
  };

  const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let msg = `Moonshot API 错误 ${res.status}`;
    if (res.status === 401) msg = 'Moonshot API Key 无效';
    if (errText) console.error('Moonshot error:', errText);
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return parseJsonResponse(text);
}

function parseJsonResponse(text: string): NutritionFacts | null {
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
  return parseJsonResponse(text);
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

