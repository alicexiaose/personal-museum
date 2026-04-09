/**
 * 收字：从 src、public/content、index.html 收集站点实际出现的字符，
 * 并按用途拆成多份文本，供 pyftsubset / subset.py 使用。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, 'out');

/** 基础拉丁与标点（正文、URL、markdown 常见符号） */
const BASE_LATIN =
  ' \n\t0123456789' +
  `!"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~` +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Cinzel 使用场景中的英文与品牌名（与源码一致） */
const CINZEL_EXTRA =
  'Personal Museum Vibe Coding ChatGPT Cursor Gemini Lovart Figma Design Archive Alice';

/** EB Garamond：导览序号、Logo 回退等 */
const EB_EXTRA = 'Alice.T0123456789';

function walkDir(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkDir(p, acc);
    else acc.push(p);
  }
}

function readUtf8(p) {
  return fs.readFileSync(p, 'utf8');
}

/** 从 TS 源码中粗提带中文的引号字符串片段（补漏 UI 文案） */
function extractCjkQuotedStrings(src) {
  const out = [];
  const re = /(['"`])((?:\\.|(?!\1)[\s\S])*?[\u4e00-\u9fff](?:\\.|(?!\1)[\s\S])*?)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[2]);
  return out.join('\n');
}

/** 提取文件中所有 CJK 及相关标点块 */
function extractCjkRuns(text) {
  return (text.match(/[\u4e00-\u9fff\u3000-\u303f\u3040-\u30ff\u31f0-\u31ff\uff00-\uffef]/g) || []).join('');
}

function uniqueSortString(s) {
  return [...new Set(s)].sort().join('');
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function main() {
  ensureDir(OUT);

  const srcFiles = [];
  walkDir(path.join(ROOT, 'src'), srcFiles);
  const tsFiles = srcFiles.filter((f) => f.endsWith('.ts'));

  let tsBlob = '';
  for (const f of tsFiles) tsBlob += readUtf8(f);

  const mdDir = path.join(ROOT, 'public/content');
  let mdBlob = '';
  if (fs.existsSync(mdDir)) {
    for (const name of fs.readdirSync(mdDir)) {
      if (name.endsWith('.md')) mdBlob += readUtf8(path.join(mdDir, name));
    }
  }

  const htmlBlob = readUtf8(path.join(ROOT, 'index.html'));

  const cjkFromTs = extractCjkRuns(tsBlob) + extractCjkRuns(extractCjkQuotedStrings(tsBlob));
  const cjkFromMd = extractCjkRuns(mdBlob);
  const cjkFromHtml = extractCjkRuns(htmlBlob);

  // Noto Serif / Sans 共用汉字与全角标点池（拆字时两族各裁一份，避免漏字）
  const cjkPool = uniqueSortString(cjkFromTs + cjkFromMd + cjkFromHtml);

  // 英文与数字：md 全文 + 固定 Cinzel/EB 补充
  const latinFromMd = mdBlob.replace(/[\u4e00-\u9fff\u3000-\u303f\u3040-\u30ff\uff00-\uffef]/g, '');
  const latinPool = uniqueSortString(BASE_LATIN + latinFromMd + CINZEL_EXTRA + EB_EXTRA);

  const notoSerifText = uniqueSortString(cjkPool + latinPool);
  const notoSansText = uniqueSortString(cjkPool + latinPool);

  const cinzelText = uniqueSortString(BASE_LATIN + CINZEL_EXTRA);
  // EB Garamond 无全角括号等 CJK 标点，勿写入；页面由 Noto 族承接
  const ebText = uniqueSortString(BASE_LATIN + EB_EXTRA);
  const cormorantText = uniqueSortString(BASE_LATIN + 'Alice'); // ui 父层默认，实际几乎不渲染正文

  fs.writeFileSync(path.join(OUT, 'noto-serif-sc.txt'), notoSerifText, 'utf8');
  fs.writeFileSync(path.join(OUT, 'noto-sans-sc.txt'), notoSansText, 'utf8');
  fs.writeFileSync(path.join(OUT, 'cinzel.txt'), cinzelText, 'utf8');
  fs.writeFileSync(path.join(OUT, 'eb-garamond.txt'), ebText, 'utf8');
  fs.writeFileSync(path.join(OUT, 'cormorant-garamond.txt'), cormorantText, 'utf8');

  const report = {
    notoSerifChars: notoSerifText.length,
    notoSansChars: notoSansText.length,
    cinzelChars: cinzelText.length,
    ebGaramondChars: ebText.length,
    cormorantChars: cormorantText.length,
    cjkUnique: cjkPool.length,
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('收字完成', report);
}

main();
