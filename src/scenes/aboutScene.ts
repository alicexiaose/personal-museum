import { ensureBoilFilter } from '../utils';

export function createAboutScene() {
  let root: HTMLDivElement | null = null;
  let prevContentHostCssText: string | null = null;
  let mountedContentHost: HTMLDivElement | null = null;

  function unmount(): void {
    root?.remove();
    root = null;
    if (mountedContentHost && prevContentHostCssText != null) {
      // 还原 overlay 的 contentHost 原始布局（不影响 info/contact）
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

  // 仅支持 **加粗**，其余按纯文本处理
  function renderWithBold(raw: string): string {
    const safe = escapeHtml(raw);
    return safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function mount(ctx: { gradientHost: HTMLDivElement; contentHost: HTMLDivElement }): void {
    unmount();

    // About 页需要全屏布局：临时把 contentHost 从“居中小盒子”切到全屏
    // 关闭 About 时会在 unmount 里还原，避免影响 info/contact
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
    root.className = 'about-scroll-root';
    root.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      overflow-y: auto;
      overflow-x: hidden;
      padding-bottom: 80px;
    `;

    // 隐藏滚动条（与 payment 等项目页 design-system-scroll-root 一致，保持可滚轮滚动）
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.textContent = `
      .about-scroll-root,
      .design-system-scroll-root {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .about-scroll-root::-webkit-scrollbar,
      .design-system-scroll-root::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
      }
    `;
    root.appendChild(scrollbarStyle);

    // 灯图作为“背景层”：不滚动（偏上显示），标题/文案压在它上面
    // lampTopVh 数值越小越靠上
    const lampTopVh = 36;
    const titleTopVh = 44;

    const lampBg = document.createElement('img');
    lampBg.src = '/pic/pic_about.png';
    lampBg.alt = '';
    lampBg.style.cssText = `
      position: absolute;
      left: 50%;
      top: ${lampTopVh}vh;
      transform: translate(-50%, -50%);
      width: 280px;
      height: auto;
      display: block;
      pointer-events: none;
      user-select: none;
      filter: ${ensureBoilFilter()};
      z-index: 0;
    `;

    const title = document.createElement('div');
    title.textContent = '个人简介';
    title.style.cssText = `
      position: absolute;
      left: 50%;
      top: ${titleTopVh}vh;
      transform: translateX(-50%);
      font-family: 'Noto Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, serif;
      font-size: 28px;
      letter-spacing: 0.22em;
      color: #FFEFBD;
      font-weight: 300;
      z-index: 2;
      pointer-events: none;
      white-space: nowrap;
      text-align: center;
    `;

    // 文案区域：占剩余高度，滚动条隐藏（与项目页一致）；底部预留 80px；标题与文案间距 64px
    const scrollViewport = document.createElement('div');
    scrollViewport.className = 'design-system-scroll-root';
    scrollViewport.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      top: calc(${titleTopVh}vh + 64px);
      bottom: 80px;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
      z-index: 1;
    `;

    const scrollInner = document.createElement('div');
    scrollInner.style.cssText = `
      width: min(680px, 86vw);
      max-width: 680px;
      margin: 0 auto;
      padding: 8px 8px 0 8px;
      box-sizing: border-box;
    `;

    const text = document.createElement('div');
    text.style.cssText = `
      font-family: 'Noto Sans SC', 'Source Han Serif CN';
      font-size: 16px;
      line-height: 2.05;
      letter-spacing: 0.08em;
      color: #DAD5C8;
      font-weight: 300;
      text-align: justify;
      text-justify: inter-ideograph; /* 中文更自然 */
      text-align-last: left; /* 最后一行别被拉伸（可选） */
    `;

    const paragraphs = [
      ` `,
      `Hi，我是唐蓊，硕士学历，数字媒体与交互设计专业。近几年一直从事 **UI / 视觉设计/体验相关工作**，主要聚焦于 **B 端复杂系统、后台平台、设计系统与业务型产品体验设计**，积累了较为完整的项目经验以及落地过北美、日本、香港的项目，也逐步形成了自己比较稳定的设计方法和判断体系。`,
      `在工作中，我不仅关注界面呈现本身，也重视设计与业务目标、用户效率、产品逻辑之间的关系。我的技能覆盖 **UI 设计、视觉设计、设计规范梳理、Design Token、组件库思维、信息层级规划、页面结构搭建、交互细节优化**等，同时也能结合项目阶段参与方案推进、设计协同与设计落地。对于复杂信息、长流程、多角色权限、数据密度高的场景，我有较强的理解和拆解能力。`,
      `未来，我希望继续在**系统化设计、复杂产品体验、设计系统建设以及 AI 相关设计协作方向**深入发展，不断提升自己从界面执行到策略判断、从单页面设计到整体体验搭建的能力，创造更有长期价值的设计成果。`,
      `我个人的特点是**逻辑清晰、责任感强、善于拆解复杂问题，也有较强的审美稳定性和落地意识**。我擅长在复杂约束下寻找更合理的设计解法，把抽象需求整理成可执行、可复用、可持续迭代的方案。`,
    ];

    for (const p of paragraphs) {
      const el = document.createElement('p');
      el.style.cssText = 'margin: 0 0 14px 0;';
      el.innerHTML = renderWithBold(p);
      text.appendChild(el);
    }

    scrollInner.appendChild(text);
    scrollViewport.appendChild(scrollInner);

    // 文案区域上下边缘渐隐（A：mask-image）
    // 说明：让“内容本身”淡出，背景纹理不被纯色遮挡
    const edgeFadeH = 48;
    scrollViewport.style.webkitMaskImage = `linear-gradient(
      to bottom,
      rgba(0,0,0,0) 0px,
      rgba(0,0,0,1) ${edgeFadeH}px,
      rgba(0,0,0,1) calc(100% - ${edgeFadeH}px),
      rgba(0,0,0,0) 100%
    )`;
    // 标准属性（部分浏览器使用）
    (scrollViewport.style as any).maskImage = `linear-gradient(
      to bottom,
      rgba(0,0,0,0) 0px,
      rgba(0,0,0,1) ${edgeFadeH}px,
      rgba(0,0,0,1) calc(100% - ${edgeFadeH}px),
      rgba(0,0,0,0) 100%
    )`;

    root.appendChild(lampBg);
    root.appendChild(title);
    root.appendChild(scrollViewport);

    ctx.contentHost.appendChild(root);
  }

  return { mount, unmount };
}

