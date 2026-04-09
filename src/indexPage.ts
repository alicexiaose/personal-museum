import { gsap } from 'gsap';
import { Assets } from 'pixi.js';
import { initMuseumBackground, type MuseumBackgroundConfig } from './museumBackground';
import { createLoadOverlay, createEnterBtn, ensureBoilFilter, createHotspotBtn, playRadialImageRevealTransition } from './utils';
import { createInfoScene } from './scenes/infoScene.ts';
import { createContactScene } from './scenes/contactScene.ts';
import { createAboutScene } from './scenes/aboutScene.ts';
import { createDesignSystemScene } from './scenes/designSystemScene.ts';
import { createMPoCScene } from './scenes/mpocScene.ts';
import { createPaymentScene } from './scenes/paymentScene.ts';
import { createTicketScene } from './scenes/ticketScene.ts';
import { createGuideScene } from './scenes/guideScene.ts';
import { createShow1Scene } from './scenes/show1Scene.ts';
import { createShow2Scene } from './scenes/show2Scene.ts';

// 避免顶层 await，以便 Vite 生产构建目标兼容 es2020
void (async () => {

// 在背景图加载前先覆盖底色，防止白屏
const loadOverlay = createLoadOverlay();

// ===== 初始化背景（四个效果全部开启）=====
const { bg, firstFrameReady, getNormalBaseScale, getNormalSafeMaxY, setConfig, getConfig, setSceneParams, reinitQuickTo, switchBackground, resetMouseState } =
  await initMuseumBackground({
    mouseParallax: true,
    tunnelScale: true,
    liquidDisplacement: true,
    boilingLines: true,
  });

// ===== 背景音乐（点击“开始看展”后播放）=====
let bgm: HTMLAudioElement | null = null;
let hasStartedBgm = false;

// 后台预热径向转场会用到的图，避免点击后再解码、上传 GPU
void Promise.all([
  Assets.load('/pic/bg_show1.jpg'),
  Assets.load('/pic/bg_show2.jpg'),
]);

// ===== 设置图一场景参数：2x 缩放 + 图片底边对齐屏幕底边 =====
// getNormalBaseScale() 返回 1x 正常缩放值，不受场景倍率影响
// bg.y = sh - th * normalBase 时，图片底边刚好贴近屏幕底部
const normalBase = getNormalBaseScale();
const normalSafeMaxY = getNormalSafeMaxY();
const multiplier = 1.6;  // ← 只需要改这一个数

const screenOneBaseY =
  window.innerHeight - (bg.texture.height * normalBase * multiplier) / 2
  + normalSafeMaxY * 0.85;

setSceneParams(multiplier, screenOneBaseY);


// ===== 遮罩层：周边暗、中间亮 =====
const vignette = document.createElement('div');
vignette.style.cssText = `
  position: fixed;
  inset: 0;
  background: radial-gradient(
    ellipse 55% 45% at 50% 50%,
    rgba(0, 0, 0, 0.05) 0%,
    rgba(0, 0, 0, 0.55) 65%,
    rgba(0, 0, 0, 0.92) 100%
  );
  z-index: 10;
  pointer-events: none;
`;
document.body.appendChild(vignette);

// ===== UI 文字层 =====
const ui = document.createElement('div');
ui.style.cssText = `
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
  font-family: 'Cormorant Garamond', 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
`;

// --- 统一顶部导航栏：logo 始终可见，声明/联系在图二 fade in ---
// 声明、联系：Noto Serif SC，字重 400
function makeNavItem(iconSrc: string, label: string, href: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.style.cssText = `
    display: flex; align-items: center; gap: 8px;
    color: #DAD5C8; text-decoration: none;
    font-family: 'Noto Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, serif;
    font-size: 16px; letter-spacing: 0.12em; cursor: pointer;
    font-weight: 400;
    opacity: 0;
    pointer-events: none;
  `;
  const img = document.createElement('img');
  img.src = iconSrc;
  img.style.cssText = 'width: 22px; height: 22px; display: block;';
  a.appendChild(img);
  a.appendChild(document.createTextNode(label));
  // 默认整体 0.7，hover 时 1（与图二可见态一致）
  a.addEventListener('mouseenter', () => {
    gsap.to(a, { opacity: 1, duration: 0.28, ease: 'power2.out' });
  });
  a.addEventListener('mouseleave', () => {
    gsap.to(a, { opacity: 0.7, duration: 0.28, ease: 'power2.out' });
  });
  return a;
}

const navInfo    = makeNavItem('/icon/icon_info.svg',    '声明', '/info.html');
const navContact = makeNavItem('/icon/icon_contact.svg', '联系', '/contact.html');

// 顶部导航点击：用 overlay 打开（不整页跳转）
navInfo.addEventListener('click', (e) => {
  e.preventDefault();
  openOverlay('info', true);
});
navContact.addEventListener('click', (e) => {
  e.preventDefault();
  openOverlay('contact', true);
});

const topBar = document.createElement('div');
topBar.id = 'museum-top-bar';
topBar.style.cssText = `
  position: fixed; top: 0; left: 0; right: 0;
  display: flex; align-items: center;
  padding: 40px 80px 22px 80px; z-index: 10050; /* 高于径向转场 overlay(9999)，确保导航不被遮住 */
`;

const tbLeft = document.createElement('div');
tbLeft.style.cssText = 'flex: 1;';
tbLeft.appendChild(navInfo);

const tbCenter = document.createElement('div');
tbCenter.style.cssText = 'flex: 1; display: flex; justify-content: center; align-items: center;';
// 图二时点击回到图一（同页状态，非整页刷新）
const logoLink = document.createElement('a');
logoLink.href = '#';
logoLink.setAttribute('aria-label', '返回首页');
logoLink.style.cssText = `
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; text-decoration: none;
`;
const logoImg = document.createElement('img');
logoImg.src = '/icon/logo.svg';
logoImg.alt = 'Alice.T';
logoImg.style.cssText = 'height: 16px; display: block; pointer-events: none; filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.47));';
logoImg.onerror = () => {
  logoImg.style.display = 'none';
  const fallback = document.createElement('span');
  fallback.textContent = 'Alice.T';
  // Logo 图失败时：Alice.T 用 EB Garamond（与导览数字同族）
  fallback.style.cssText = `
    font-family: 'EB Garamond', 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
    font-weight: 400;
    font-size: 24px; letter-spacing: 0.3em;
    color: #c8bfa8; text-transform: uppercase; pointer-events: none;
  `;
  logoLink.appendChild(fallback);
};
logoLink.appendChild(logoImg);
tbCenter.appendChild(logoLink);

const tbRight = document.createElement('div');
tbRight.style.cssText = 'flex: 1; display: flex; justify-content: flex-end;';
tbRight.appendChild(navContact);

topBar.appendChild(tbLeft);
topBar.appendChild(tbCenter);
topBar.appendChild(tbRight);
document.body.appendChild(topBar);

// --- 中央内容区 ---
const centerBlock = document.createElement('div');
centerBlock.style.cssText = `
  position: absolute;
  top: 44%;
  left: 50%;
  transform: translate(-50%, -54%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  width: 100%;
`;

// 副标题：Personal Museum
const subTitle = document.createElement('p');
subTitle.style.cssText = `
  color: #E4D9B9;
  text-transform: uppercase;
  font-family: 'Cinzel', serif;
  font-weight: 400;
  text-align: center;
  margin: 0;
  line-height: 1;
  letter-spacing: 0.2em;
  white-space: nowrap;
`;

subTitle.innerHTML = `
  <span style="font-size:18px;">
    <span style="font-size:26px;">P</span>ersonal
  </span>
  <span style="display:inline-block; width:0.45em;"></span>
  <span style="font-size:18px;">
    <span style="font-size:26px;">M</span>useum
  </span>
`;

centerBlock.appendChild(subTitle);

// 主标题：Design Archive SVG
const titleImg = document.createElement('img');
titleImg.src = '/icon/Design Archive.svg';
titleImg.alt = 'Design Archive';
titleImg.style.cssText = `
  width: min(900px, 86vw);
  display: block;
`;
// 如果 SVG 加载失败，回退到文字
titleImg.onerror = () => {
  titleImg.style.display = 'none';
  const fallback = document.createElement('p');
  fallback.textContent = 'Design Archive';
  fallback.style.cssText = `
    font-size: clamp(48px, 10vw, 120px);
    letter-spacing: 0.04em;
    color: #d8cfb0;
    font-weight: 300;
  `;
  centerBlock.insertBefore(fallback, descText);
};
centerBlock.appendChild(titleImg);

// 描述文字
const descText = document.createElement('p');
descText.textContent = '这里展示了我八年的设计沉淀，希望你能在此遇见你想要的';
descText.style.cssText = `
  font-size: 16px;
  letter-spacing: 0.16em;
  color: #DAD5C8;
  font-family: 'Noto Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, serif;
  font-weight: 300;
  margin-top: 20px;
`;
centerBlock.appendChild(descText);

ui.appendChild(centerBlock);

// --- 底部按钮区 ---
const bottomBlock = document.createElement('div');
bottomBlock.style.cssText = `
  position: absolute;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  pointer-events: auto;
`;

// 按钮：透明容器 + 图片
const btn = document.createElement('button');
btn.style.cssText = `
  background: none; border: none; padding: 0; margin: 0;
  cursor: pointer; outline: none;
  display: inline-flex; align-items: center; justify-content: center;
`;

const btnImg = document.createElement('img');
btnImg.src = '/pic/pic_start.png';
btnImg.alt = '开始看展';
btnImg.style.cssText = `
  display: block;
  height: 48px; width: auto;
  transform-origin: center;
  filter: ${ensureBoilFilter()};
  pointer-events: none;
`;
btn.appendChild(btnImg);

btn.addEventListener('mouseenter', () => {
  gsap.to(btnImg, { scale: 1.08, duration: 0.3, ease: 'power2.out' });
});

btn.addEventListener('mouseleave', () => {
  gsap.to(btnImg, { scale: 1, duration: 0.3, ease: 'power2.out' });
});

bottomBlock.appendChild(btn);

// 音频提示文字
const audioHint = document.createElement('p');
audioHint.textContent = '开启声音，体验更佳';
audioHint.style.cssText = `
  font-size: 12px;
  font-weight: 300;
  letter-spacing: 0.12em;
  color:rgba(228, 217, 185, 0.6);
  font-family: 'Noto Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, serif;
`;
bottomBlock.appendChild(audioHint);

ui.appendChild(bottomBlock);
document.body.appendChild(ui);

// 等背景首帧真正呈现后，再淡出加载底色，避免先露出遮罩层
firstFrameReady.then(() => {
  loadOverlay.hide();
});

// ===== 图一入场动画 =====
// 初始隐藏
gsap.set(subTitle,  { clipPath: 'inset(0 100% 0 0)' });
gsap.set(titleImg,  { clipPath: 'inset(0 100% 0 0)' });
gsap.set([descText, audioHint], { opacity: 0, y: 20 });
gsap.set(btn, { opacity: 0 });
btn.style.pointerEvents = 'none';

const introTl = gsap.timeline({ delay: 0.4 });

// 1. "Personal Museum"：clip-path 从左到右 steps 揭现（打字机感）
introTl.to(subTitle, {
  clipPath: 'inset(0 0% 0 0)',
  duration: 0.3,
  ease: 'steps(6)',
}, 0);

// 2. "Design Archive"：0.2s 后跟进，步进揭现
introTl.to(titleImg, {
  clipPath: 'inset(0 0% 0 0)',
  duration: 0.6,
  ease: 'steps(9)',
}, 0.2);

// 3. 描述文字 + 音频提示：标题完成后 0.5s，从下往上浮现
introTl.to([descText, audioHint], {
  opacity: 1,
  y: 0,
  duration: 0.7,
  ease: 'power2.out',
  stagger: 0.15,
}, 1.0);

// 4. 按钮：渐现
introTl.to(btn, {
  opacity: 1,
  duration: 0.7,
  ease: 'power2.inout',
  onStart: () => { btn.style.pointerEvents = 'auto'; },
}, 1.6);

// 各屏 DOM 与 ticker 的卸载函数
let disposeScreen2: (() => void) | null = null;
let disposeShow1: (() => void) | null = null;
let disposeShow2: (() => void) | null = null;
type ScreenName = 'screen1' | 'screen2' | 'show1' | 'show2';
let currentScreen: ScreenName = 'screen1';
let isMuseumTransitioning = false;

type MainScreenRoute = 'screen1' | 'screen2' | 'show1' | 'show2';
type OverlayRoute = 'info' | 'contact' | 'about' | 'design-system' | 'mpoc' | 'payment' | 'ticket' | 'guide';

function getMainRouteFromCurrentScreen(): MainScreenRoute {
  return currentScreen as MainScreenRoute;
}

function setMainHash(route: MainScreenRoute): void {
  history.replaceState(null, '', `#/${route}`);
}

// ===== 刷新行为：强制回到初始 screen1 =====
// 目标：无论刷新时 URL 是 /info.html、/contact.html 还是 #/guide、#/design-system
// 都强制回到 screen1，并且不会因为初始 hash 自动打开 overlay。
// 注意：这只影响“页面启动/刷新”的还原逻辑；运行中点击打开 overlay 的逻辑保持不变。
{
  history.replaceState(null, '', '/#/screen1');
}

function getHashRouteSegment(): string {
  const h = window.location.hash || '';
  if (!h) return '';
  if (h.startsWith('#/')) return h.slice(2);
  if (h.startsWith('#')) return h.slice(1);
  return h;
}

function parseOverlayRoute(seg: string): OverlayRoute | null {
  if (seg === 'info') return 'info';
  if (seg === 'contact') return 'contact';
  if (seg === 'about') return 'about';
  if (seg === 'design-system') return 'design-system';
  if (seg === 'mpoc') return 'mpoc';
  if (seg === 'payment') return 'payment';
  if (seg === 'ticket') return 'ticket';
  if (seg === 'guide') return 'guide';
  return null;
}

// ===== 声明/联系 overlay（仅叠加 DOM，不卸载底层场景）=====
let overlayEl: HTMLDivElement | null = null;
let overlayRoute: OverlayRoute | null = null;
let isOverlayOpen = false;
let overlayFromMainHash = '#/screen2';
let prevNavInfoOpacity = '';
let prevNavContactOpacity = '';
let prevNavInfoPointerEvents = '';
let prevNavContactPointerEvents = '';
let hasPrevNavState = false;
// 声明/联系层首开时记下背景四开关，关闭层时再还原（切换 info/contact 不重拍；关层动画中途再开也不覆盖已有快照）
let overlaySavedBgConfig: MuseumBackgroundConfig | null = null;

/** overlay 完全卸掉后恢复打开前背景效果 */
function restoreOverlayBackgroundIfSaved(): void {
  if (!overlaySavedBgConfig) return;
  setConfig(overlaySavedBgConfig);
  overlaySavedBgConfig = null;
}

type OverlayScene = {
  mount: (ctx: { gradientHost: HTMLDivElement; contentHost: HTMLDivElement }) => void;
  unmount: () => void;
};

const infoScene: OverlayScene = createInfoScene();
const contactScene: OverlayScene = createContactScene();
const aboutScene: OverlayScene = createAboutScene();
const designSystemScene: OverlayScene = createDesignSystemScene();
const mpocScene: OverlayScene = createMPoCScene();
const paymentScene: OverlayScene = createPaymentScene();
const ticketScene: OverlayScene = createTicketScene();
const guideScene: OverlayScene = createGuideScene({ transitionToShow1, transitionToShow2 });
let mountedOverlayScene: OverlayScene | null = null;

const show1Scene = createShow1Scene();
const show2Scene = createShow2Scene();

function ensureOverlayEl(): HTMLDivElement {
  if (overlayEl) return overlayEl;

  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; inset: 0;
    z-index: 9000; /* 低于 topBar(z=10050)，确保导航始终在最上层可点 */
    background: #1E1E1A;
    display: none;
    overflow: auto;
  `;

  const textureLayer = document.createElement('div');
  textureLayer.style.cssText = `
    position: absolute; inset: 0;
    background-image: url('/dist/pic/texture%20map.png');
    background-repeat: repeat;
    background-size: 248px 248px;
    opacity: 1;
    pointer-events: none;
  `;
  el.appendChild(textureLayer);

  // scene 用：声明页的黄色椭圆渐变叠层等
  const gradientHost = document.createElement('div');
  gradientHost.style.cssText = `
    position: absolute; inset: 0;
    pointer-events: none;
  `;
  el.appendChild(gradientHost);

  const content = document.createElement('div');
  content.style.cssText = `
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -54%);
    max-width: 800px;
    width: min(800px, 86vw);
    text-align: center;
    font-family: 'Noto Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, serif;
    padding: 18px;
  `;

  // contentHost 交给 infoScene / contactScene 挂载具体内容
  el.appendChild(content);

  const cinzelStyle = document.createElement('style');
  cinzelStyle.textContent = `
    .overlay-cinzel { font-family: 'Cinzel', serif; font-weight: 400; }
  `;
  el.appendChild(cinzelStyle);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.style.cssText = `
    position: fixed;
    right: 48px; bottom: 48px;
    width: 48px; height: 48px;
    padding: 0; margin: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    z-index: 1;
  `;

  const closeImg = document.createElement('img');
  closeImg.src = '/icon/icon_close.svg';
  closeImg.alt = '关闭';
  closeImg.style.cssText = `
    width: 48px; height: 48px; display: block;
    transition: transform 0.18s ease, filter 0.18s ease;
  `;
  closeBtn.appendChild(closeImg);

  closeBtn.addEventListener('mouseenter', () => {
    closeImg.style.transform = 'scale(1.06)';
    closeImg.style.filter = 'brightness(1.18)';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeImg.style.transform = 'scale(1)';
    closeImg.style.filter = 'none';
  });
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeOverlay(true);
  });
  el.appendChild(closeBtn);

  // 缓存宿主节点，供 scene mount/unmount
  (el as any).__gradientHost = gradientHost;
  (el as any).__contentHost = content;

  overlayEl = el;
  return el;
}

function openOverlay(route: OverlayRoute, pushHistory: boolean): void {
  if (isOverlayOpen && overlayRoute === route) return;

  const openingFromClosedOverlay = !isOverlayOpen;
  isOverlayOpen = true;
  overlayRoute = route;
  overlayFromMainHash = `#/${getMainRouteFromCurrentScreen()}`;

  // 仅从「未叠加声明/联系」进入时降 GPU：保留当时四开关以便关闭时还原
  if (openingFromClosedOverlay) {
    if (overlaySavedBgConfig == null) {
      overlaySavedBgConfig = getConfig();
    }
    setConfig({ mouseParallax: false, tunnelScale: false, liquidDisplacement: false, boilingLines: false });
    resetMouseState();
  }

  // overlay 打开时顶部导航强制常显；关闭时恢复原状态
  prevNavInfoOpacity = navInfo.style.opacity;
  prevNavContactOpacity = navContact.style.opacity;
  prevNavInfoPointerEvents = navInfo.style.pointerEvents;
  prevNavContactPointerEvents = navContact.style.pointerEvents;
  hasPrevNavState = true;
  gsap.killTweensOf([navInfo, navContact]);
  navInfo.style.pointerEvents = 'auto';
  navContact.style.pointerEvents = 'auto';
  gsap.set([navInfo, navContact], { opacity: 0.7 });

  if (pushHistory) {
    // 先让“回退目标 URL”对齐到当前场景，再 push overlay
    history.replaceState(null, '', overlayFromMainHash);
    window.location.hash = `#/${route}`;
  }

  const el = ensureOverlayEl();
  const gradientHost = (el as any).__gradientHost as HTMLDivElement;
  const contentHost = (el as any).__contentHost as HTMLDivElement;

  mountedOverlayScene?.unmount();
  mountedOverlayScene = null;

  const nextScene =
    route === 'info' ? infoScene :
    route === 'contact' ? contactScene :
    route === 'design-system' ? designSystemScene :
    route === 'mpoc' ? mpocScene :
    route === 'payment' ? paymentScene :
    route === 'ticket' ? ticketScene :
    route === 'guide' ? guideScene :
    aboutScene;
  nextScene.mount({ gradientHost, contentHost });
  mountedOverlayScene = nextScene;

  const freshlyAttached = !el.isConnected;
  if (freshlyAttached) {
    gsap.set(el, { opacity: 0 });
    document.body.appendChild(el);
  }
  el.style.display = 'block';
  el.style.pointerEvents = 'auto';
  gsap.killTweensOf(el);

  if (freshlyAttached) {
    gsap.to(el, { opacity: 1, duration: 0.48, ease: 'power2.out' });
  } else {
    const fromOp = Number(gsap.getProperty(el, 'opacity'));
    const o = Number.isFinite(fromOp) ? fromOp : 1;
    if (o < 0.98) {
      gsap.to(el, { opacity: 1, duration: 0.32, ease: 'power2.out' });
    } else {
      gsap.set(el, { opacity: 1 });
    }
  }
}

function closeOverlay(syncHash: boolean): void {
  const el = overlayEl;
  if (!isOverlayOpen || !el) return;
  isOverlayOpen = false;
  overlayRoute = null;

  const sync = syncHash;
  const restoreNav = hasPrevNavState;
  const pio = prevNavInfoOpacity;
  const pco = prevNavContactOpacity;
  const pip = prevNavInfoPointerEvents;
  const pcp = prevNavContactPointerEvents;

  hasPrevNavState = false;

  el.style.pointerEvents = 'none';
  gsap.killTweensOf(el);
  gsap.to(el, {
    opacity: 0,
    duration: 0.4,
    ease: 'power1.in',
    onComplete: () => {
      if (isOverlayOpen) return;
      mountedOverlayScene?.unmount();
      mountedOverlayScene = null;
      if (overlayEl === el) {
        el.remove();
        overlayEl = null;
      }
      if (sync) {
        history.replaceState(null, '', overlayFromMainHash);
      }
      if (restoreNav) {
        navInfo.style.opacity = pio;
        navContact.style.opacity = pco;
        navInfo.style.pointerEvents = pip;
        navContact.style.pointerEvents = pcp;
      }
      restoreOverlayBackgroundIfSaved();
    },
  });
}

// 按主场景同步顶栏两侧入口（声明/联系）显隐，避免只依赖 overlay 打开时的快照
function applyTopNavForScreen(screen: MainScreenRoute): void {
  gsap.killTweensOf([navInfo, navContact]);
  if (screen === 'screen1') {
    navInfo.style.pointerEvents = 'none';
    navContact.style.pointerEvents = 'none';
    gsap.set([navInfo, navContact], { opacity: 0 });
  } else {
    navInfo.style.pointerEvents = 'auto';
    navContact.style.pointerEvents = 'auto';
    gsap.set([navInfo, navContact], { opacity: 0.7 });
  }
}

// Logo 转场、回图一等主流程前调用：摘掉声明/联系层，并把 hash 从 #/info|contact 拉回当前场景，避免与 hashchange、历史栈打架导致闪回
function dismissOverlayBeforeMainTransition(): void {
  if (!isOverlayOpen) return;
  const main = getMainRouteFromCurrentScreen();
  isOverlayOpen = false;
  overlayRoute = null;
  if (overlayEl) {
    gsap.killTweensOf(overlayEl);
  }
  mountedOverlayScene?.unmount();
  mountedOverlayScene = null;
  overlayEl?.remove();
  overlayEl = null;
  hasPrevNavState = false;
  history.replaceState(null, '', `#/${main}`);
  applyTopNavForScreen(main);
  restoreOverlayBackgroundIfSaved();
}

// 径向转场仍会盖住声明层（z=9999>9000）时调用：只卸 DOM，不改 hash（由转场 onComplete 负责）
function stripOverlayLayerIfOpen(): void {
  if (!isOverlayOpen && !overlayEl) return;
  isOverlayOpen = false;
  overlayRoute = null;
  if (overlayEl) {
    gsap.killTweensOf(overlayEl);
  }
  mountedOverlayScene?.unmount();
  mountedOverlayScene = null;
  overlayEl?.remove();
  overlayEl = null;
  hasPrevNavState = false;
  restoreOverlayBackgroundIfSaved();
}

// hashchange 只管 overlay 打开/关闭，不参与底层场景切换
window.addEventListener('hashchange', () => {
  const seg = getHashRouteSegment();
  const overlay = parseOverlayRoute(seg);
  if (overlay) {
    if (!isOverlayOpen || overlayRoute !== overlay) openOverlay(overlay, false);
  } else {
    // show/show2 Logo 进图二：先 replaceState 拉回主 hash，径向层盖在声明上；此时期望保留声明 DOM，等 onCovered 再 strip
    if (isOverlayOpen && !isMuseumTransitioning) closeOverlay(false);
  }
});

// 首屏：强制回到 screen1（不根据初始 hash 自动开 overlay）
setMainHash('screen1');

// ===== 图二 UI =====
/** onFullyMounted：进入按钮与 ticker 挂完后回调（用于再设 currentScreen / 解除转场锁） */
function showMuseumScreen2UI(onFullyMounted?: () => void): void {
  // 将视口百分比位置转为图像归一化坐标（相对图像中心的比例），后续跨窗口尺寸复用
  const tw = bg.texture.width;
  const th = bg.texture.height;
  const initScale = getNormalBaseScale();
  function vpToImgNorm(leftPct: number, topPct: number): { nx: number; ny: number } {
    return {
      nx: (window.innerWidth * leftPct / 100 - bg.x) / (tw * initScale),
      ny: (window.innerHeight * topPct / 100 - bg.y) / (th * initScale),
    };
  }

  // 热点组件：视觉由 createHotspotBtn 负责，此处只做坐标换算
  function createHotspot(
    leftPct: number,
    topPct: number,
    side: 'left' | 'right',
    href: string,
    label: string,
  ): { el: HTMLDivElement; imgNx: number; imgNy: number; xTranslate: string } {
    const { nx: imgNx, ny: imgNy } = vpToImgNorm(leftPct, topPct);
    const { el, xTranslate } = createHotspotBtn(side, href, label);
    return { el, imgNx, imgNy, xTranslate };
  }

  const hp1 = createHotspot(42, 50, 'left', '/about.html', '个人简介');
  const hp2 = createHotspot(60, 62, 'right', '#/guide', '导览');
  document.body.appendChild(hp1.el);
  document.body.appendChild(hp2.el);

  // 个人简介：不整页跳转，复用 overlay（更顺滑也更省）
  {
    const link = hp1.el.querySelector('a') as HTMLAnchorElement | null;
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openOverlay('about', true);
      });
    }
  }

  // 导览：不整页跳转，复用 overlay
  {
    const link = hp2.el.querySelector('a') as HTMLAnchorElement | null;
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openOverlay('guide', true);
      });
    }
  }

  // ----- 左右进入按钮 -----
  // side='left' 时 leftPct 代表按钮中心横坐标；side='right' 时用 (100 - leftPct) 换算
  function makeEnterBtn(
    side: 'left' | 'right',
    leftPct: number,
    topPct: number,
    href: string,
  ): { el: HTMLAnchorElement; imgNx: number; imgNy: number } {
    const { nx: imgNx, ny: imgNy } = vpToImgNorm(
      side === 'left' ? leftPct : 100 - leftPct,
      topPct,
    );
    // 视觉结构由 createEnterBtn 负责，此处只做坐标换算
    const el = createEnterBtn(side, href);
    return { el, imgNx, imgNy };
  }

  const enterLeft  = makeEnterBtn('left',  8, 50, '#');
  const enterRight = makeEnterBtn('right', 8, 50, '#');

  // 进入按钮与 ticker 延后一帧挂载，减轻单帧 style/layout 峰值
  function mountEnterAndWire(): void {
    document.body.appendChild(enterLeft.el);
    document.body.appendChild(enterRight.el);
    // 左侧进入按钮：从按钮位置展开圆形过渡到 show1
    enterLeft.el.addEventListener('click', (e) => {
      e.preventDefault();
      const rect = enterLeft.el.getBoundingClientRect();
      transitionToShow1(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    // 右侧进入按钮：从按钮位置展开圆形过渡到 show2
    enterRight.el.addEventListener('click', (e) => {
      e.preventDefault();
      const rect = enterRight.el.getBoundingClientRect();
      transitionToShow2(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    wireParallaxAndDispose();
    runScreen2IntroTweens();
    onFullyMounted?.();
  }

  // ----- 视差跟随：全部元素基于图像坐标定位，跨窗口尺寸保持一致 -----
  const imgElList = [
    { el: hp1.el,        nx: hp1.imgNx,        ny: hp1.imgNy,        xt: hp1.xTranslate },
    { el: hp2.el,        nx: hp2.imgNx,        ny: hp2.imgNy,        xt: hp2.xTranslate },
    { el: enterLeft.el,  nx: enterLeft.imgNx,  ny: enterLeft.imgNy,  xt: '-50%' },
    { el: enterRight.el, nx: enterRight.imgNx, ny: enterRight.imgNy, xt: '-50%' },
  ];

  function updateImgAnchoredPositions(): void {
    const s = bg.scale.x;
    imgElList.forEach(({ el, nx, ny, xt }) => {
      const x = bg.x + nx * tw * s;
      const y = bg.y + ny * th * s;
      el.style.transform = `translate(calc(${x}px + ${xt}), calc(${y}px - 50%))`;
    });
  }

  function wireParallaxAndDispose(): void {
    gsap.ticker.add(updateImgAnchoredPositions);

    disposeScreen2 = (): void => {
      gsap.ticker.remove(updateImgAnchoredPositions);
      hp1.el.remove();
      hp2.el.remove();
      enterLeft.el.remove();
      enterRight.el.remove();
      disposeScreen2 = null;
    };
  }

  function runScreen2IntroTweens(): void {
    // ----- 分阶段淡入 -----
    gsap.to([navInfo, navContact], {
      opacity: 0.7,
      duration: 1.2,
      ease: 'power2.out',
      delay: 0.4,
      onComplete: () => {
        navInfo.style.pointerEvents = 'auto';
        navContact.style.pointerEvents = 'auto';
      },
    });
    // 热点按钮出现动画：左先、右后 0.5s，渐显 + 轻微从大缩到正常
    gsap.fromTo(hp1.el,
      { opacity: 0, scale: 1.18 },
      { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.inout', delay: 0.8 },
    );
    gsap.fromTo(hp2.el,
      { opacity: 0, scale: 1.18 },
      { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.inout', delay: 1.3 },
    );
    gsap.to([enterLeft.el, enterRight.el], { opacity: 1, duration: 1.4, ease: 'power2.out', delay: 1.6 });
  }

  requestAnimationFrame(mountEnterAndWire);
}

// 图二 -> 图一：清理图二 UI + 反向镜头 + 恢复遮罩与首屏 UI
function goToScreen1(): void {
  if (currentScreen !== 'screen2' || isMuseumTransitioning) return;
  isMuseumTransitioning = true;
  disposeScreen2?.();

  setConfig({ mouseParallax: false, tunnelScale: false, liquidDisplacement: false });

  gsap.killTweensOf([navInfo, navContact]);
  navInfo.style.pointerEvents = 'none';
  navContact.style.pointerEvents = 'none';
  gsap.to([navInfo, navContact], { opacity: 0, duration: 0.35, ease: 'power1.in' });

  document.body.appendChild(vignette);
  gsap.set(vignette, { opacity: 0 });
  document.body.appendChild(ui);
  gsap.set(ui, { opacity: 0 });

  const targetY = screenOneBaseY;
  const targetX = window.innerWidth / 2;
  const targetScale = getNormalBaseScale() * multiplier;

  const reverseTl = gsap.timeline({
    onComplete: () => {
      setSceneParams(multiplier, screenOneBaseY, false);
      reinitQuickTo();
      setConfig({ mouseParallax: true, tunnelScale: true, liquidDisplacement: true });
      gsap.set([ui, vignette], { opacity: 1 });
      btn.style.pointerEvents = 'auto';
      currentScreen = 'screen1';
      setMainHash('screen1');
      isMuseumTransitioning = false;
    },
  });

  reverseTl.to(vignette, { opacity: 1, duration: 1.4, ease: 'power1.inOut' }, 0);
  reverseTl.to(ui, { opacity: 1, duration: 0.85, ease: 'power2.out' }, 0.45);
  reverseTl.to(bg, { y: targetY, duration: 1.6, ease: 'power3.in', overwrite: 'auto' }, 0);
  reverseTl.to(bg, { x: targetX, duration: 1.2, ease: 'power3.in', overwrite: 'auto' }, 0);
  reverseTl.to(bg.scale, { x: targetScale, y: targetScale, duration: 1.4, ease: 'power1.inOut', overwrite: true }, 0.3);
}

logoLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (currentScreen === 'screen2') {
    dismissOverlayBeforeMainTransition();
    goToScreen1();
  } else if (currentScreen === 'show1') {
    // 声明页 z 低于径向转场：不可先 dismiss，否则闪一下底层 show1
    transitionToScreen2FromShow1(window.innerWidth / 2, window.innerHeight / 2);
  } else if (currentScreen === 'show2') {
    transitionToScreen2FromShow2(window.innerWidth / 2, window.innerHeight / 2);
  } else {
    dismissOverlayBeforeMainTransition();
  }
});

// ===== 转场：图一 -> 图二 =====
btn.addEventListener('click', () => {
  if (isMuseumTransitioning) return;
  isMuseumTransitioning = true;
  btn.style.pointerEvents = 'none';

  // 点击手势触发播放，避免浏览器自动播放限制
  if (!hasStartedBgm) {
    hasStartedBgm = true;
    bgm = new Audio('/audio/audio_bgm.mp3');
    bgm.loop = true;
    bgm.volume = 0.4;
    void bgm.play();
  }

  // 1. 停止交互效果；同时关闭 liquidDisplacement 避免 displaceSprite 与 bg 位置错位产生扭曲
  setConfig({ mouseParallax: false, tunnelScale: false, liquidDisplacement: false });

  // 2. 文字层提前淡出
  gsap.to(ui, { opacity: 0, duration: 0.55, ease: 'power1.in' });

  // 3. 遮罩随转场消退
  gsap.to(vignette, { opacity: 0, duration: 1.5, ease: 'power1.inOut' });

  // 4. 缩放 + 位移同步进行：镜头边缩小边上移，从当前视差位置出发
  //    setConfig 已无自动 snap，两个动画都从当前实际状态出发
  const targetScale = getNormalBaseScale();
  const targetX = window.innerWidth / 2;
  const targetY = window.innerHeight / 2;

  // 分层 timeline：位置先动（镜头上升感），scale 稍后跟进（视野展开稍滞后）
  // overwrite: true 杀掉残留的 quickTo tween，确保转场无跳动
  const transitionTl = gsap.timeline({
    onComplete: () => {
      ui.remove();
      vignette.remove();

      // setSceneParams 先调，确保 reinitQuickTo 内 getBaseScale() 返回正确值
      setSceneParams(1.0, undefined, false);
      reinitQuickTo();
      setConfig({ mouseParallax: true, tunnelScale: true, liquidDisplacement: true });
      // 双 rAF：把大量 DOM 挂到下一帧之后，避免与转场收尾挤在同一主线程任务里（降 INP、长任务）
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          showMuseumScreen2UI(() => {
            currentScreen = 'screen2';
            setMainHash('screen2');
            isMuseumTransitioning = false;
          });
        });
      });
    },
  });

  // 先移动（镜头上移感），再缩小（视野展开），两段明显分开
  transitionTl.to(bg, { y: targetY, duration: 1.6, ease: 'power3.out', overwrite: 'auto' }, 0);
  transitionTl.to(bg, { x: targetX, duration: 1.2, ease: 'power3.out', overwrite: 'auto' }, 0);
  transitionTl.to(bg.scale, { x: targetScale, y: targetScale, duration: 1.4, ease: 'power1.inOut', overwrite: true }, 0.3);
});

// ===== 圆形展开过渡：图二 -> show1 =====
function transitionToShow1(clickX: number, clickY: number): void {
  if (isMuseumTransitioning) return;
  isMuseumTransitioning = true;

  // 从 overlay（如导览）发起转场：只先“悄悄”改回主 hash（不触发 hashchange），避免闪回导览
  // guide 的 DOM 卸载延后到径向遮罩真正插入 DOM 之后，避免先露出 screen2
  history.replaceState(null, '', `#/${getMainRouteFromCurrentScreen()}`);

  setConfig({ mouseParallax: false, tunnelScale: false, liquidDisplacement: false });

  playRadialImageRevealTransition(clickX, clickY, '/pic/bg_show1.jpg', async () => {
    disposeScreen2?.();

    await switchBackground('/pic/bg_show1.jpg');
    setSceneParams(1.0, undefined, true);
    reinitQuickTo();
    // 过渡后光标仍在按钮一侧，先归零鼠标采样再开视差/隧道缩放，避免画面向反方向轻微弹跳
    resetMouseState();
    setConfig({ mouseParallax: true, tunnelScale: true, liquidDisplacement: true, boilingLines: true });
    showShow1ScreenUI();
    currentScreen = 'show1';
    setMainHash('show1');
    isMuseumTransitioning = false;
  }, (overlayEl) => {
    // 遮罩插入时 clip-path 仍是 0px，立刻卸载 overlay 会露出 screen2。
    // 与 playRadialImageRevealTransition 内部的“双 rAF 设置 clipPath”对齐：再多等一帧再卸载。
    overlayEl.style.pointerEvents = 'all';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          stripOverlayLayerIfOpen();
        });
      });
    });
  });
}

// ===== 圆形展开过渡：图二 -> show2 =====
function transitionToShow2(clickX: number, clickY: number): void {
  if (isMuseumTransitioning) return;
  isMuseumTransitioning = true;

  // 从 overlay（如导览）发起转场：只先“悄悄”改回主 hash（不触发 hashchange），避免闪回导览
  // guide 的 DOM 卸载延后到径向遮罩真正插入 DOM 之后，避免先露出 screen2
  history.replaceState(null, '', `#/${getMainRouteFromCurrentScreen()}`);

  setConfig({ mouseParallax: false, tunnelScale: false, liquidDisplacement: false });

  playRadialImageRevealTransition(clickX, clickY, '/pic/bg_show2.jpg', async () => {
    disposeScreen2?.();

    await switchBackground('/pic/bg_show2.jpg');
    setSceneParams(1.0, undefined, true);
    reinitQuickTo();

    resetMouseState();
    setConfig({ mouseParallax: true, tunnelScale: true, liquidDisplacement: true, boilingLines: true });

    showShow2ScreenUI();
    currentScreen = 'show2';
    setMainHash('show2');
    isMuseumTransitioning = false;
  }, (overlayEl) => {
    // 遮罩插入时 clip-path 仍是 0px，立刻卸载 overlay 会露出 screen2。
    // 与 playRadialImageRevealTransition 内部的“双 rAF 设置 clipPath”对齐：再多等一帧再卸载。
    overlayEl.style.pointerEvents = 'all';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          stripOverlayLayerIfOpen();
        });
      });
    });
  });
}

// ===== 圆形展开过渡：show1 -> 图二 =====
function transitionToScreen2FromShow1(clickX: number, clickY: number): void {
  if (isMuseumTransitioning) return;
  isMuseumTransitioning = true;

  if (isOverlayOpen) {
    history.replaceState(null, '', '#/show1');
    applyTopNavForScreen('show1');
  }

  setConfig({ mouseParallax: false, tunnelScale: false, liquidDisplacement: false });

  playRadialImageRevealTransition(clickX, clickY, '/pic/bg_museum.jpg', async () => {
    stripOverlayLayerIfOpen();
    disposeShow1?.();

    await switchBackground('/pic/bg_museum.jpg');
    setSceneParams(1.0, undefined, true);
    reinitQuickTo();
    resetMouseState();
    setConfig({ mouseParallax: true, tunnelScale: true, liquidDisplacement: true, boilingLines: true });
    showMuseumScreen2UI(() => {
      currentScreen = 'screen2';
      setMainHash('screen2');
      isMuseumTransitioning = false;
    });
  });
}

// ===== 圆形展开过渡：show2 -> 图二 =====
function transitionToScreen2FromShow2(clickX: number, clickY: number): void {
  if (isMuseumTransitioning) return;
  isMuseumTransitioning = true;

  if (isOverlayOpen) {
    history.replaceState(null, '', '#/show2');
    applyTopNavForScreen('show2');
  }

  setConfig({ mouseParallax: false, tunnelScale: false, liquidDisplacement: false });

  playRadialImageRevealTransition(clickX, clickY, '/pic/bg_museum.jpg', async () => {
    stripOverlayLayerIfOpen();
    disposeShow2?.();

    await switchBackground('/pic/bg_museum.jpg');
    setSceneParams(1.0, undefined, true);
    reinitQuickTo();

    resetMouseState();
    setConfig({ mouseParallax: true, tunnelScale: true, liquidDisplacement: true, boilingLines: true });

    showMuseumScreen2UI(() => {
      currentScreen = 'screen2';
      setMainHash('screen2');
      isMuseumTransitioning = false;
    });
  });
}

// ===== show2 UI =====
function showShow2ScreenUI(): void {
  show2Scene.mount({
    bg,
    getNormalBaseScale,
    navInfo,
    navContact,
    transitionToScreen2FromShow2,
  });
  disposeShow2 = () => {
    show2Scene.unmount();
    disposeShow2 = null;
  };
  return;
}

// ===== show1 UI =====
function showShow1ScreenUI(): void {
  show1Scene.mount({
    bg,
    getNormalBaseScale,
    navInfo,
    navContact,
    transitionToScreen2FromShow1,
    openDesignSystemOverlay: () => openOverlay('design-system', true),
  });
  disposeShow1 = () => {
    show1Scene.unmount();
    disposeShow1 = null;
  };
  return;
}

})();
