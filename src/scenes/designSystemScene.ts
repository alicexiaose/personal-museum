import { ensureBoilFilter } from '../utils';

/** 顶栏 DOM id，与 indexPage 中 topBar 一致，用于测量导航实际高度 */
const MUSEUM_TOP_BAR_ID = 'museum-top-bar';

const DESIGN_SYSTEM_MD_URL = '/content/design-system.md';
const PROJECT_CONFIDENTIAL_NOTE =
  '*受 B 端项目保密限制，本页仅展示部分项目片段。更多完整内容可参考我的简历与作品集。';

export function createDesignSystemScene() {
  let root: HTMLDivElement | null = null;
  let prevContentHostCssText: string | null = null;
  let mountedContentHost: HTMLDivElement | null = null;
  let onResize: (() => void) | null = null;

  function unmount(): void {
    if (onResize) {
      window.removeEventListener('resize', onResize);
      onResize = null;
    }
    root?.remove();
    root = null;
    if (mountedContentHost && prevContentHostCssText != null) {
      mountedContentHost.style.cssText = prevContentHostCssText;
    }
    mountedContentHost = null;
    prevContentHostCssText = null;
  }

  function escapeHtml(s: string): string {
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderWithBold(raw: string): string {
    const safe = escapeHtml(raw);
    return safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  /** 按空行分段；段首 ### 为小标题，其余为正文段 */
  function buildArticleNodes(container: HTMLDivElement, raw: string): void {
    const bodyFont = `
      font-family: 'Noto Sans SC', 'Source Han Serif CN';
      font-size: 16px;
      line-height: 1.76;
      letter-spacing: 0.01em;
      color:rgba(218, 213, 200, 0.65);
      font-weight: 300;
      text-align: justify;
      text-justify: inter-ideograph;
      text-align-last: left;
    `;

    const flushParagraph = (lines: string[]): void => {
      const t = lines.join('\n').trim();
      if (!t) return;
      const p = document.createElement('p');
      p.style.cssText = `margin: 0 0 24px 0; ${bodyFont}`;
      p.innerHTML = renderWithBold(t);
      container.appendChild(p);
    };

    const flushHeading = (title: string): void => {
      const h = document.createElement('h3');
      h.textContent = title.trim();
      h.style.cssText = `
        margin: 56px 0 8px 0;
        font-family: 'Noto Sans SC', 'Source Han Serif CN';
        font-size: 20px;
        line-height: 1.6;
        letter-spacing: 0.08em;
        color:rgba(218, 213, 200, 0.78);
        font-weight: 500;
      `;
      if (container.children.length === 0) h.style.marginTop = '0';
      container.appendChild(h);
    };

    const flushList = (kind: 'ol' | 'ul', items: string[]): void => {
      if (items.length === 0) return;

      const list = document.createElement(kind);
      list.style.cssText = `
        margin: 0 0 18px 0;
        padding-left: 22px;
        ${bodyFont}
        text-align: left;
        text-justify: auto;
        text-align-last: auto;
      `;
      for (const item of items) {
        const li = document.createElement('li');
        li.style.cssText = `
          margin: 0 0 16px 0;
          padding: 0;
        `;
        li.innerHTML = renderWithBold(item.trim());
        list.appendChild(li);
      }
      // 最后一条不要额外撑开
      const last = list.lastElementChild as HTMLLIElement | null;
      if (last) last.style.marginBottom = '0';

      container.appendChild(list);
    };

    const lines = raw.replaceAll('\r\n', '\n').split('\n');
    const paragraphLines: string[] = [];
    let listKind: 'ol' | 'ul' | null = null;
    const listItems: string[] = [];

    const flushAll = (): void => {
      if (listKind) {
        flushList(listKind, listItems);
        listKind = null;
        listItems.length = 0;
      }
      if (paragraphLines.length) {
        flushParagraph(paragraphLines);
        paragraphLines.length = 0;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const t = line.trim();

      // 空行：结束当前段/列表
      if (!t) {
        flushAll();
        continue;
      }

      // 小标题
      if (t.startsWith('### ')) {
        flushAll();
        flushHeading(t.slice(4));
        continue;
      }

      // 有序列表：1. xxx
      const olMatch = t.match(/^(\d+)\.\s+(.+)$/);
      if (olMatch) {
        // 如果正在写段落，先落段
        if (paragraphLines.length) {
          flushParagraph(paragraphLines);
          paragraphLines.length = 0;
        }
        // 如果之前是无序列表，先落无序列表
        if (listKind && listKind !== 'ol') {
          flushList(listKind, listItems);
          listItems.length = 0;
        }
        listKind = 'ol';
        listItems.push(olMatch[2]);
        continue;
      }

      // 无序列表：- xxx
      const ulMatch = t.match(/^-+\s+(.+)$/);
      if (ulMatch) {
        if (paragraphLines.length) {
          flushParagraph(paragraphLines);
          paragraphLines.length = 0;
        }
        if (listKind && listKind !== 'ul') {
          flushList(listKind, listItems);
          listItems.length = 0;
        }
        listKind = 'ul';
        listItems.push(ulMatch[1]);
        continue;
      }

      // 普通文字：如果前面在写列表，先把列表落地
      if (listKind) {
        flushList(listKind, listItems);
        listKind = null;
        listItems.length = 0;
      }
      paragraphLines.push(line);
    }

    flushAll();
  }

  function mount(ctx: { gradientHost: HTMLDivElement; contentHost: HTMLDivElement }): void {
    unmount();

    mountedContentHost = ctx.contentHost;
    prevContentHostCssText = ctx.contentHost.style.cssText;
    ctx.contentHost.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      max-width: none;
      transform: none;
      top: 0;
      left: 0;
      text-align: left;
      padding: 0;
      box-sizing: border-box;
    `;

    root = document.createElement('div');
    root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
    `;

    const scrollViewport = document.createElement('div');
    scrollViewport.className = 'design-system-scroll-root';
    scrollViewport.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      bottom: 80px;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
      z-index: 0;
    `;

    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.textContent = `
      .design-system-scroll-root {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .design-system-scroll-root::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
      }
    `;
    root.appendChild(scrollbarStyle);

    const applyScrollTopOffset = (): void => {
      const bar = document.getElementById(MUSEUM_TOP_BAR_ID);
      const navH = bar ? bar.getBoundingClientRect().height : 0;
      scrollViewport.style.top = `${navH + 8}px`;
    };
    applyScrollTopOffset();
    onResize = () => applyScrollTopOffset();
    window.addEventListener('resize', onResize);

    const scrollInner = document.createElement('div');
    scrollInner.style.cssText = `
      width: min(680px, 86vw);
      max-width: 680px;
      margin: 0 auto;
      padding: 0 8px 48px 8px;
      box-sizing: border-box;
    `;

    // hero 单独加宽（与素材 1000px 对齐），正文仍在下方 scrollInner 窄列
    const heroBand = document.createElement('div');
    heroBand.style.cssText = `
      width: 100%;
      max-width: 1000px;
      margin: 0 auto;
      box-sizing: border-box;
    `;

    // 顶部素材 1000×532：固定高度 532；在 heroBand 内横向铺满，宽≤1200 时与成稿比例一致、少裁切
    const heroH = 532;
    const heroWrap = document.createElement('div');
    heroWrap.style.cssText = `
      position: relative;
      width: 100%;
      height: ${heroH}px;
      overflow: hidden;
    `;

    const heroImg = document.createElement('img');
    heroImg.src = '/pic/pic_design%20system.png';
    heroImg.alt = '';
    heroImg.style.cssText = `
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center center;
      pointer-events: none;
      user-select: none;
      filter: ${ensureBoilFilter()};
    `;
    heroWrap.appendChild(heroImg);

    const quote = document.createElement('div');
    quote.style.cssText = `
      position: absolute;
      left: 50%;
      bottom: 64px;
      transform: translateX(-50%);
      width: min(520px, 86vw);
      text-align: center;
      font-family: 'Noto Serif SC', 'Source Han Serif CN';
      font-size: 14px;
      line-height: 1.7;
      letter-spacing: 0.08em;
      color: #CBC2D0;
      font-weight: 300;
      pointer-events: none;
    `;
    quote.innerHTML =
      '在复杂的 B 端业务背后，是极致简洁的底层逻辑，<br/>就如蒙德里安将世界简化为最基础的点、线、面。';
    heroWrap.appendChild(quote);

    heroBand.appendChild(heroWrap);

    const dash = document.createElement('div');
    dash.style.cssText = `
      width: 100%;
      height: 1px;
      border: none;
      background: repeating-linear-gradient(
      90deg,rgba(103, 101, 87, 0.73) 0 2px,   /* 实线段长度 8px */
      transparent 8px 10px  /* 空白到 24px = 间隔 16px */
      );
      margin: 8px 0px 44px 0px;
      `;
    scrollInner.appendChild(dash);

    const pageTitle = document.createElement('div');
    pageTitle.textContent = '设计系统构建';
    pageTitle.style.cssText = `
      text-align: center;
      font-family: 'Noto Serif SC', 'Source Han Serif CN';
      font-size: 28px;
      line-height: 1.6;
      letter-spacing: 0.08em;
      color: #C3B2D3;
      font-weight: 400;
      margin: 0 0 32px 0;
    `;
    scrollInner.appendChild(pageTitle);

    const article = document.createElement('div');
    scrollInner.appendChild(article);
    void (async () => {
      const raw = await fetch(DESIGN_SYSTEM_MD_URL).then((r) => r.text());
      article.replaceChildren();
      buildArticleNodes(article, raw);
    })();

    const tailImg = document.createElement('img');
    tailImg.src = '/pic/pic_design%20system2.png';
    tailImg.alt = '';
    tailImg.style.cssText = `
      display: block;
      width: 100%;
      height: auto;
      margin-top: 28px;
      pointer-events: none;
      user-select: none;
    `;
    scrollInner.appendChild(tailImg);

    const confidentialNote = document.createElement('div');
    confidentialNote.textContent = PROJECT_CONFIDENTIAL_NOTE;
    confidentialNote.style.cssText = `
      margin: 2px 0 0 0;
      font-family: 'Noto Sans SC', 'Source Han Serif CN';
      font-size: 14px;
      line-height: 1.6;
      letter-spacing: 0.01em;
      color: rgba(218, 213, 200, 0.42);
      font-weight: 300;
    `;
    scrollInner.appendChild(confidentialNote);

    scrollViewport.appendChild(heroBand);
    scrollViewport.appendChild(scrollInner);
    root.appendChild(scrollViewport);

    const edgeFadeH = 48;
    scrollViewport.style.webkitMaskImage = `linear-gradient(
      to bottom,
      rgba(0,0,0,0) 0px,
      rgba(0,0,0,1) ${edgeFadeH}px,
      rgba(0,0,0,1) calc(100% - ${edgeFadeH}px),
      rgba(0,0,0,0) 100%
    )`;
    (scrollViewport.style as any).maskImage = `linear-gradient(
      to bottom,
      rgba(0,0,0,0) 0px,
      rgba(0,0,0,1) ${edgeFadeH}px,
      rgba(0,0,0,1) calc(100% - ${edgeFadeH}px),
      rgba(0,0,0,0) 100%
    )`;

    ctx.contentHost.appendChild(root);
  }

  return { mount, unmount };
}
