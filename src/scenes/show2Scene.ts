import { gsap } from 'gsap';
import { createEnterBtn, createHotspotBtn } from '../utils';

export function createShow2Scene() {
  let hp1: HTMLDivElement | null = null;
  let hp2: HTMLDivElement | null = null;
  let enterBtn: HTMLAnchorElement | null = null;
  let disposeFn: (() => void) | null = null;

  let updatePositions: (() => void) | null = null;
  let imgElList: Array<{ el: HTMLElement; nx: number; ny: number; xt: string }> = [];

  function vpToImgNorm(args: { bg: any; tw: number; th: number; initScale: number; leftPct: number; topPct: number }): { nx: number; ny: number } {
    const { bg, tw, th, initScale, leftPct, topPct } = args;
    return {
      nx: (window.innerWidth * leftPct / 100 - bg.x) / (tw * initScale),
      ny: (window.innerHeight * topPct / 100 - bg.y) / (th * initScale),
    };
  }

  function unmount(): void {
    disposeFn?.();
    disposeFn = null;

    updatePositions = null;
    imgElList = [];

    hp1?.remove();
    hp2?.remove();
    enterBtn?.remove();

    hp1 = null;
    hp2 = null;
    enterBtn = null;
  }

  function mount(ctx: {
    bg: any;
    getNormalBaseScale: () => number;
    navInfo: HTMLElement;
    navContact: HTMLElement;
    transitionToScreen2FromShow2: (clickX: number, clickY: number) => void;
  }): void {
    unmount();

    const { bg, getNormalBaseScale, navInfo, navContact, transitionToScreen2FromShow2 } = ctx;
    const tw = bg.texture.width;
    const th = bg.texture.height;
    const initScale = getNormalBaseScale();

    function createHotspot(args: {
      leftPct: number;
      topPct: number;
      side: 'left' | 'right';
      href: string;
      label: string;
    }): { el: HTMLDivElement; imgNx: number; imgNy: number; xTranslate: string } {
      const { leftPct, topPct, side, href, label } = args;
      const { nx: imgNx, ny: imgNy } = vpToImgNorm({ bg, tw, th, initScale, leftPct, topPct });
      const { el, xTranslate } = createHotspotBtn(side, href, label);
      return { el, imgNx, imgNy, xTranslate };
    }

    const h1 = createHotspot({
      leftPct: 12,
      topPct: 50,
      side: 'right',
      href: '#/payment',
      label: '北美支付应用优化升级',
    });
    const h2 = createHotspot({
      leftPct: 52,
      topPct: 64,
      side: 'right',
      href: '#/ticket',
      label: '工单系统构建',
    });
    hp1 = h1.el;
    hp2 = h2.el;
    document.body.appendChild(hp1);
    document.body.appendChild(hp2);

    const eBtn = createEnterBtn('left', '#');
    const enterLabelEl = eBtn.querySelector('span');
    if (enterLabelEl) enterLabelEl.textContent = '返回';
    const iconEl = eBtn.querySelector('img') as HTMLImageElement | null;
    if (iconEl) iconEl.src = '/icon/icon_upback.svg';
    enterBtn = eBtn;
    document.body.appendChild(enterBtn);

    const enterNv = vpToImgNorm({ bg, tw, th, initScale, leftPct: 54, topPct: 42 });
    const enterNx = enterNv.nx;
    const enterNy = enterNv.ny;

    imgElList = [
      { el: hp1, nx: h1.imgNx, ny: h1.imgNy, xt: h1.xTranslate },
      { el: hp2, nx: h2.imgNx, ny: h2.imgNy, xt: h2.xTranslate },
      { el: enterBtn, nx: enterNx, ny: enterNy, xt: '-50%' },
    ];

    updatePositions = () => {
      const s = bg.scale.x;
      imgElList.forEach(({ el, nx, ny, xt }) => {
        const x = bg.x + nx * tw * s;
        const y = bg.y + ny * th * s;
        el.style.transform = `translate(calc(${x}px + ${xt}), calc(${y}px - 50%))`;
      });
    };
    gsap.ticker.add(updatePositions);

    disposeFn = () => {
      if (updatePositions) gsap.ticker.remove(updatePositions);
    };

    enterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const rect = enterBtn!.getBoundingClientRect();
      transitionToScreen2FromShow2(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    // 导航栏保持可见：show2 过程中不做任何透明度变化
    navInfo.style.pointerEvents = 'auto';
    navContact.style.pointerEvents = 'auto';
    gsap.set([navInfo, navContact], { opacity: 0.7 });

    // 热点按钮出现：左先，右后 0.5s
    gsap.fromTo(hp1, { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.inOut', delay: 0.5 });
    gsap.fromTo(hp2, { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.inOut', delay: 1.0 });
    gsap.to(enterBtn, { opacity: 1, duration: 1.4, ease: 'power2.out', delay: 1.4 });
  }

  return { mount, unmount };
}

