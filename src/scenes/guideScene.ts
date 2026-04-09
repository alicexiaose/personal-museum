export function createGuideScene(args: {
  /** 从某个点击点切到 show1 */
  transitionToShow1: (clickX: number, clickY: number) => void;
  /** 从某个点击点切到 show2 */
  transitionToShow2: (clickX: number, clickY: number) => void;
}): { mount: (ctx: { gradientHost: HTMLDivElement; contentHost: HTMLDivElement }) => void; unmount: () => void } {
  /** 顶栏 DOM id，与 indexPage 中 topBar 一致，用于测量导航实际高度 */
  const MUSEUM_TOP_BAR_ID = 'museum-top-bar';

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

  function makeRow(argsRow: {
    index: number;
    title: string;
    onClick: (clickX: number, clickY: number) => void;
  }): HTMLDivElement {
    const { index, title, onClick } = argsRow;

    const row = document.createElement('div');
    row.style.cssText = `
      width: min(480px, 82vw);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      padding: 4px 6px;
      margin: 0;
      background: transparent;
      border: 0;
      cursor: default;
      text-align: left;
      color: #DAD5C8;
      font-family: 'Noto Sans SC', 'Source Han Serif CN', 'Songti SC', STSong, serif;
      font-size: 20px;
      letter-spacing: 0.08em;
      font-weight: 300;
    `;

    const left = document.createElement('div');
    left.style.cssText = `
      display: flex;
      align-items: baseline;
      gap: 18px;
      min-width: 0;
      flex: 1;
    `;

    const num = document.createElement('span');
    num.textContent = String(index);
    num.style.cssText = `
      width: 14px;
      flex-shrink: 0;
      color: #FFF0C2;
      font-variant-numeric: tabular-nums;
      font-size: 24px;
      font-weight: 300;
      font-family: 'EB Garamond', 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
    `;

    const text = document.createElement('span');
    text.textContent = title;
    text.style.cssText = `
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: 'Noto Sans SC', 'Source Han Serif CN', 'Songti SC', STSong, serif;
    `;

    left.appendChild(num);
    left.appendChild(text);

    const arrowBtn = document.createElement('button');
    arrowBtn.type = 'button';
    arrowBtn.style.cssText = `
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
      border: 0;
      background: transparent;
      opacity: 0.8;
      transition: transform 0.18s ease, opacity 0.18s ease;
      cursor: pointer;
    `;

    const arrowImg = document.createElement('img');
    arrowImg.src = '/icon/icon_arrowright.svg';
    arrowImg.alt = '';
    arrowImg.style.cssText = `
      width: 32px;
      height: 32px;
      display: block;
      pointer-events: none;
      user-select: none;
    `;
    arrowBtn.appendChild(arrowImg);

    arrowBtn.addEventListener('mouseenter', () => {
      arrowBtn.style.transform = 'translateX(4px)';
      arrowBtn.style.opacity = '1';
    });
    arrowBtn.addEventListener('mouseleave', () => {
      arrowBtn.style.transform = 'translateX(0px)';
      arrowBtn.style.opacity = '0.8';
    });

    // 只允许点击右侧箭头
    arrowBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = arrowBtn.getBoundingClientRect();
      onClick(r.left + r.width / 2, r.top + r.height / 2);
    });

    row.appendChild(left);
    row.appendChild(arrowBtn);

    return row;
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
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
    `;

    // 用 spacer + wrap 来“扣掉”顶部导航占用高度，避免 padding 造成溢出滚动
    const topSpacer = document.createElement('div');
    topSpacer.style.cssText = `
      width: 100%;
      flex: 0 0 auto;
      height: 0px;
    `;

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      width: 100%;
      flex: 0 0 auto;
      min-height: 0;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      overflow: visible;
    `;

    root = document.createElement('div');
    root.style.cssText = `
      width: min(760px, 86vw);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0px;
      padding: 0;
      box-sizing: border-box;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin-top: 0px;
    `;

    const icon = document.createElement('img');
    icon.src = '/icon/icon_guide.svg';
    icon.alt = '';
    icon.style.cssText = `
      width: auto;
      height: 34px;
      display: block;
      opacity: 0.95;
      pointer-events: none;
      user-select: none;
    `;
    header.appendChild(icon);

    const title = document.createElement('div');
    title.textContent = '展区导览';
    title.style.cssText = `
      font-family: 'Noto Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, serif;
      font-size: 28px;
      letter-spacing: 0.08em;
      color: #FFF0C2;
      font-weight: 400;
      text-align: center;
      margin-top: 32px;
    `;
    header.appendChild(title);

    const dash = document.createElement('div');
    dash.style.cssText = `
      width: min(480px, 82vw);
      height: 1px;
      border: none;
      background: repeating-linear-gradient(
        90deg,
        rgba(218, 213, 200, 0.45) 0 2px,
        transparent 8px 12px
      );
      margin-top: 12px;
    `;
    header.appendChild(dash);

    root.appendChild(header);

    const list = document.createElement('div');
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      margin-top: 18px;
    `;

    list.appendChild(makeRow({
      index: 1,
      title: '设计系统构建',
      onClick: (x, y) => args.transitionToShow1(x, y),
    }));
    list.appendChild(makeRow({
      index: 2,
      title: 'MPoC 安全监控与认证平台设计',
      onClick: (x, y) => args.transitionToShow1(x, y),
    }));
    list.appendChild(makeRow({
      index: 3,
      title: '北美支付应用优化升级',
      onClick: (x, y) => args.transitionToShow2(x, y),
    }));
    list.appendChild(makeRow({
      index: 4,
      title: '工单系统构建',
      onClick: (x, y) => args.transitionToShow2(x, y),
    }));

    root.appendChild(list);

    const applyLayout = (): void => {
      // 中间内容区域高度 = 页面 - 顶部导航 - 底部边距 -（导航与中间区域间距）
      const bar = document.getElementById(MUSEUM_TOP_BAR_ID);
      const navH = bar ? bar.getBoundingClientRect().height : 0;
      const navGap = 24;
      const bottomPad = 80;
      topSpacer.style.height = `${navH + navGap}px`;

      const middleH = Math.max(0, Math.floor(window.innerHeight - navH - navGap - bottomPad));
      wrap.style.height = `${middleH}px`;

      // 两次测量：先把 icon 设为 0，测出“固定内容高度”，再把剩余高度给 icon
      icon.style.height = `0px`;
      const fixedH = root ? root.getBoundingClientRect().height : 0;
      const iconH = Math.max(0, Math.floor(middleH - fixedH));
      icon.style.height = `${iconH}px`;

      // 如果 icon 足够高，则“整块”在可用区内上下居中
      if (iconH > 440) {
        wrap.style.alignItems = 'center';
      } else {
        wrap.style.alignItems = 'flex-start';
      }
    };

    wrap.appendChild(root);
    ctx.contentHost.appendChild(topSpacer);
    ctx.contentHost.appendChild(wrap);

    // 初次挂载后等一帧再测量（确保字体/布局已落地）
    requestAnimationFrame(() => applyLayout());
    onResize = () => applyLayout();
    window.addEventListener('resize', onResize);
  }

  return { mount, unmount };
}

