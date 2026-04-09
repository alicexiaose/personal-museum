import { gsap } from 'gsap';

/**
 * 注入全局 SVG 扰动滤镜（只创建一次），每 14 帧随机跳 seed 模拟手绘定格抖动。
 * 返回 CSS filter 字符串 `url(#hp-boil-filter)`，可直接赋值给 element.style.filter。
 */
export function ensureBoilFilter(): string {
  const filterId = 'hp-boil-filter';
  if (document.getElementById(filterId)) return `url(#${filterId})`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;overflow:hidden;';
  svg.innerHTML = `<defs>
    <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feTurbulence id="hp-boil-turb" type="fractalNoise" baseFrequency="0.04 0.06" numOctaves="2" seed="1" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>`;
  document.body.appendChild(svg);
  let frame = 0;
  const turb = svg.querySelector('#hp-boil-turb') as SVGFETurbulenceElement;
  const loop = () => {
    if (++frame % 14 === 0) turb.setAttribute('seed', String(Math.floor(Math.random() * 1000)));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return `url(#${filterId})`;
}

/**
 * 创建左右进入按钮元素（仅负责 DOM 结构与样式，不处理定位）。
 * side='left'  排列：[图标] [间距] [进入]
 * side='right' 排列：[进入] [间距] [图标]
 */
export function createEnterBtn(
  side: 'left' | 'right',
  href: string,
): HTMLAnchorElement {
  const el = document.createElement('a');
  el.href = href;
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    position: fixed; left: 0; top: 0;
    color:rgba(255, 238, 189, 0.4);
    text-decoration: none;
    font-family: 'Noto Serif SC', STSong, serif;
    font-size: 14px;
    letter-spacing: 0.12em;
    cursor: pointer;
    z-index: 10;
    opacity: 0;
  `;

  const icon = document.createElement('img');
  icon.src = side === 'left' ? '/icon/icon_left.svg' : '/icon/icon_right.svg';
  icon.width  = 18;
  icon.height = 18;
  icon.style.cssText = 'display: block; flex-shrink: 0; opacity: 0.4;';

  const label = document.createElement('span');
  label.textContent = '进入';

  if (side === 'left') {
    el.appendChild(icon);
    el.appendChild(label);
  } else {
    el.appendChild(label);
    el.appendChild(icon);
  }

  el.addEventListener('mouseenter', () => {
    gsap.to(el,   { color: 'rgba(255, 238, 189, 1)', duration: 0.28, ease: 'power2.out' });
    gsap.to(icon, { opacity: 1,                      duration: 0.28, ease: 'power2.out' });
  });
  el.addEventListener('mouseleave', () => {
    gsap.to(el,   { color: 'rgba(255, 238, 189, 0.4)', duration: 0.28, ease: 'power2.out' });
    gsap.to(icon, { opacity: 0.4,                      duration: 0.28, ease: 'power2.out' });
  });

  return el;
}

/**
 * 创建热点按钮视觉组件（圆点 + 图片按钮 + hover 标签），不包含坐标逻辑。
 * side='left': [imgBtn][dot]；side='right': [dot][imgBtn]
 * 返回外层容器 el 和横向偏移字符串 xTranslate（供图像坐标定位使用）。
 */
export function createHotspotBtn(
  side: 'left' | 'right',
  href: string,
  label: string,
): { el: HTMLDivElement; xTranslate: string } {
  // 圆点关键帧只注入一次
  if (!document.getElementById('hotspot-dot-kf')) {
    const kf = document.createElement('style');
    kf.id = 'hotspot-dot-kf';
    kf.textContent = `
      @keyframes dotBreath {
        0%, 100% { transform: scale(1); opacity: 0.65; }
        50% { transform: scale(1.3); opacity: 1; }
      }
      @keyframes dotRipple {
        0%   { transform: scale(1); opacity: 0.5; }
        100% { transform: scale(2.8); opacity: 0; }
      }
    `;
    document.head.appendChild(kf);
  }

  const outer = document.createElement('div');
  outer.style.cssText = `
    position: fixed; left: 0; top: 0;
    display: flex; align-items: center; gap: 12px;
    z-index: 10; opacity: 0; user-select: none;
  `;

  const dotWrap = document.createElement('div');
  dotWrap.style.cssText = 'position: relative; width: 8px; height: 8px; flex-shrink: 0;';
  const dotRing = document.createElement('div');
  dotRing.style.cssText = `
    position: absolute; inset: 0; border-radius: 50%;
    background: rgba(255, 228, 132, 0.7);
    animation: dotRipple 1.8s ease-out infinite;
  `;
  const dotCore = document.createElement('div');
  dotCore.style.cssText = `
    position: absolute; inset: 0; border-radius: 50%;
    background: #FFE484; box-shadow: 0 0 2px 0px #FFE484;
    animation: dotBreath 1.5s ease-in-out infinite;
  `;
  dotWrap.appendChild(dotRing);
  dotWrap.appendChild(dotCore);

  const btnOuter = document.createElement('div');
  btnOuter.style.cssText = 'position: relative; flex-shrink: 0; cursor: pointer;';

  const btnLink = document.createElement('a');
  btnLink.href = href;
  btnLink.style.cssText = 'display: block; text-decoration: none; position: relative; z-index: 1;';

  const imgEl = document.createElement('img');
  imgEl.src = '/pic/pic_click.png';
  imgEl.width = 58;
  imgEl.height = 58;
  imgEl.style.cssText = `display: block; transform-origin: center; pointer-events: none; filter: ${ensureBoilFilter()};`;
  btnLink.appendChild(imgEl);
  btnOuter.appendChild(btnLink);

  const hoverLabel = document.createElement('span');
  hoverLabel.textContent = label;
  hoverLabel.style.cssText = `
    position: absolute;
    top: 50%; transform: translateY(-50%);
    ${side === 'left' ? 'right: calc(100% + 8px);' : 'left: calc(100% + 8px);'}
    font-size: 14px; color: rgba(255, 238, 189, 0.7);
    white-space: nowrap; opacity: 0; pointer-events: none;
    font-family: 'Noto Sans SC', sans-serif; font-weight: 300;
  `;
  btnOuter.appendChild(hoverLabel);

  btnOuter.addEventListener('mouseenter', () => {
    gsap.to(imgEl,      { scale: 1.12, duration: 0.3, ease: 'power2.out' });
    gsap.to(hoverLabel, { opacity: 1,  duration: 0.3, ease: 'power2.out' });
  });
  btnOuter.addEventListener('mouseleave', () => {
    gsap.to(imgEl,      { scale: 1,   duration: 0.3, ease: 'power2.out' });
    gsap.to(hoverLabel, { opacity: 0, duration: 0.2, ease: 'power2.in'  });
  });

  if (side === 'left') {
    outer.appendChild(btnOuter);
    outer.appendChild(dotWrap);
  } else {
    outer.appendChild(dotWrap);
    outer.appendChild(btnOuter);
  }

  return { el: outer, xTranslate: side === 'left' ? 'calc(-100% + 8px)' : '-8px' };
}

/** 与 museumBackground.ts 中 coverScale 一致，保证 DOM 铺图与 Pixi 主背景对齐 */
export const MUSEUM_BG_COVER_SCALE = 1.15;

/**
 * 从点击点圆形展开「目标背景图」直至铺满视口，铺满后执行 onCovered（可 async），再移除遮罩层。
 * 使用与 Pixi 相同的 cover 倍率，减少揭层后与 canvas 的错位感。
 */
export function playRadialImageRevealTransition(
  fromX: number,
  fromY: number,
  imageUrl: string,
  onCovered: () => Promise<void>,
  onOverlayMounted?: (overlayEl: HTMLDivElement) => void,
): void {
  const maxR = Math.ceil(Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2)) + 100;

  let started = false;
  const runExpand = (): void => {
    if (started) return;
    started = true;

    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const iw = img.naturalWidth || sw;
    const ih = img.naturalHeight || sh;
    const scale = Math.max(sw / iw, sh / ih) * MUSEUM_BG_COVER_SCALE;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0;
      z-index: 9999; pointer-events: all;
      background-repeat: no-repeat;
      background-position: center center;
      background-size: ${iw * scale}px ${ih * scale}px;
      clip-path: circle(0px at ${fromX}px ${fromY}px);
      transition: clip-path 0.55s cubic-bezier(0.4, 0, 1, 1);
    `;
    overlay.style.backgroundImage = `url(${JSON.stringify(imageUrl)})`;
    document.body.appendChild(overlay);
    onOverlayMounted?.(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.style.clipPath = `circle(${maxR}px at ${fromX}px ${fromY}px)`;
      });
    });

    overlay.addEventListener(
      'transitionend',
      () => {
        void onCovered().then(() => {
          overlay.remove();
        });
      },
      { once: true },
    );
  };

  const img = new Image();
  img.decoding = 'async';
  img.onload = runExpand;
  img.src = imageUrl;
  if (img.complete && img.naturalWidth > 0) {
    runExpand();
  }
}

/**
 * 创建加载底色遮罩，防止图片加载前出现白屏或黑屏。
 * 调用后立即覆盖全屏，await 背景初始化完成后调用返回的 hide() 淡出移除。
 */
export function createLoadOverlay(): { hide: (delay?: number) => void } {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: #23241F;
    z-index: 99999;
    pointer-events: none;
  `;
  document.body.appendChild(overlay);

  return {
    /**
     * 淡出并移除遮罩。
     * @param delay 延迟多少秒后开始淡出，默认 0
     */
    hide(delay = 0) {
      gsap.to(overlay, {
        opacity: 0,
        duration: 0.6,
        delay,
        ease: 'power1.out',
        onComplete: () => overlay.remove(),
      });
    },
  };
}
