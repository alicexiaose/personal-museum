import {
  Application,
  Assets,
  Sprite,
  TilingSprite,
  RenderTexture,
  Container,
  DisplacementFilter,
} from 'pixi.js';
import { gsap } from 'gsap';

// ===== 背景模块配置类型 =====
export type MuseumBackgroundConfig = {
  // 鼠标驱动：背景位移（相机视差）
  mouseParallax: boolean;
  // 鼠标驱动：基于鼠标距离的隧道缩放
  tunnelScale: boolean;
  // 液体扰动：开启位移滤镜链路（离屏渲染 + DisplacementFilter）
  liquidDisplacement: boolean;
  // 手绘定格：控制 flowMap 的跳帧 tilePosition 抖动
  boilingLines: boolean;
};

// 对外暴露的背景控制句柄
export type MuseumBackgroundHandle = {
  app: Application;
  bg: Sprite;
  // 首帧背景真正绘制完成后 resolve，用于控制加载遮罩退场时机
  firstFrameReady: Promise<void>;
  // 当前场景倍率下的缩放值（图一为 2x，图二为 1x）
  getBaseScale: () => number;
  // 不含场景倍率的正常 1x 缩放值，用于计算转场目标 scale 和图一底部 baseY
  getNormalBaseScale: () => number;
  getNormalSafeMaxY: () => number;
  coverBackground: () => void;
  setConfig: (next: Partial<MuseumBackgroundConfig>) => void;
  getConfig: () => MuseumBackgroundConfig;
  // 设置场景基础参数：scaleMultiplier 决定缩放基准，baseY 决定视差静止中心 y
  // snapBg = false 时只重置内部参数，不 snap bg 位置（用于转场结束时）
  setSceneParams: (scaleMultiplier: number, baseY?: number, snapBg?: boolean) => void;
  // 切换主背景图（扰动层、四个开关、场景参数均保持不变）
  switchBackground: (imagePath: string) => Promise<void>;
  // 将鼠标状态归零，避免重新开启 tunnelScale 时首帧突变
  resetMouseState: () => void;
  // 重建所有 quickTo 函数（转场后恢复交互效果用）
  reinitQuickTo: () => void;
};

const defaultConfig: MuseumBackgroundConfig = {
  mouseParallax: true,
  tunnelScale: true,
  liquidDisplacement: true,
  boilingLines: true,
};

export async function initMuseumBackground(
  initConfig: Partial<MuseumBackgroundConfig> = {},
  bgImagePath = '/pic/bg_museum.jpg',
  displacePath = '/pic/displace%20map.png',
): Promise<MuseumBackgroundHandle> {
  let enabledConfig: MuseumBackgroundConfig = { ...defaultConfig, ...initConfig };
  let resolveFirstFrame!: () => void;
  const firstFrameReady = new Promise<void>((resolve) => {
    resolveFirstFrame = resolve;
  });

  // 场景基础参数：供图一（2x 缩放 + 低角度）复用同一套背景系统
  let sceneScaleMultiplier = 1.0; // 缩放基准倍率，默认正常（1x）
  let sceneBaseY: number | null = null; // 静止中心 y，null 表示屏幕中心

  // ===== 页面基础样式 =====
  document.documentElement.style.margin = '0';
  document.documentElement.style.width = '100%';
  document.documentElement.style.height = '100%';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.margin = '0';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#111';

  // ===== Pixi App =====
  // resolution 上限减轻集显 / 高分屏上的显存与片元压力；全屏滤镜链很贵，与 JPG 压到多小关系不大
  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const cappedResolution = Math.min(pixelRatio, 1.5);
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#111111',
    antialias: false,
    resolution: cappedResolution,
  });

  // 移除旧 canvas（避免热重载重复添加）
  const oldCanvas = document.getElementById('museum-bg-canvas');
  if (oldCanvas) oldCanvas.remove();

  app.canvas.id = 'museum-bg-canvas';
  document.body.appendChild(app.canvas);

  app.canvas.style.position = 'fixed';
  app.canvas.style.left = '0';
  app.canvas.style.top = '0';
  app.canvas.style.width = '100vw';
  app.canvas.style.height = '100vh';
  app.canvas.style.display = 'block';
  // canvas 在最底层，UI 层叠在上方
  app.canvas.style.zIndex = '0';

  // ===== 主图 =====
  const heroTexture = await Assets.load(bgImagePath);
  const bg = new Sprite(heroTexture);
  bg.anchor.set(0.5);
  app.stage.addChild(bg);

  // 主图正常 cover，保留安全边距
  const coverScale = 1.15;
  let safeMaxX = 0;
  let safeMaxY = 0;
  // 始终基于 1x 缩放的安全位移上限，用于鼠标视差位移量（保证各场景视觉位移一致）
  let normalSafeMaxX = 0;
  let normalSafeMaxY = 0;
  const maxShrink = 0.05; // 预设最大缩小比例 (5%)

  function getNormalBaseScale(): number {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const tw = bg.texture.width;
    const th = bg.texture.height;
    // 不含场景倍率，始终返回 1x 正常缩放值
    return Math.max(sw / tw, sh / th) * coverScale;
  }

  function getBaseScale(): number {
    // 乘以场景倍率：图一为 2x，图二为 1x
    return getNormalBaseScale() * sceneScaleMultiplier;
  }

  function coverBackground(): void {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const tw = bg.texture.width;
    const th = bg.texture.height;

    // 1. 计算基础缩放（含场景倍率）
    const baseScale = Math.max(sw / tw, sh / th) * coverScale * sceneScaleMultiplier;
    bg.scale.set(baseScale);
    bg.x = sw / 2;
    // 使用场景基准 y：图一传入偏下的值，图二默认屏幕中心
    bg.y = sceneBaseY ?? sh / 2;

    // 2. 【最关键的修正】：计算移动极限时，必须扣除缩小导致的尺寸损失
    // 图片缩小后的宽度 = tw * baseScale * (1 - maxShrink)
    const shrunkWidth = tw * baseScale * (1 - maxShrink);
    const shrunkHeight = th * baseScale * (1 - maxShrink);

    // 当前场景的安全位移（保证图片不出屏幕边缘）
    safeMaxX = Math.max(0, (shrunkWidth - sw) / 2 - 5);
    safeMaxY = Math.max(0, (shrunkHeight - sh) / 2 - 5);

    // 始终基于 1x 缩放的安全位移（用于视差位移量，使图一图二视觉位移量一致）
    const normalBase = Math.max(sw / tw, sh / th) * coverScale;
    const normalShrunkW = tw * normalBase * (1 - maxShrink);
    const normalShrunkH = th * normalBase * (1 - maxShrink);
    normalSafeMaxX = Math.max(0, (normalShrunkW - sw) / 2 - 5);
    normalSafeMaxY = Math.max(0, (normalShrunkH - sh) / 2 - 5);
  }

  coverBackground();

  // ===== 扰动图：TilingSprite -> RenderTexture -> Sprite =====
  const noiseTexture = await Assets.load(displacePath);

  // 真正负责连续流动的平铺层
  const flowMap = new TilingSprite({
    texture: noiseTexture,
    width: window.innerWidth + 800,
    height: window.innerHeight + 800,
  });

  // 核心参数
  flowMap.tileScale.set(0.06, 0.06);

  // 放进离屏容器
  const flowContainer = new Container();
  flowContainer.addChild(flowMap);

  // 离屏纹理
  const flowRT = RenderTexture.create({
    width: window.innerWidth + 800,
    height: window.innerHeight + 800,
  });

  // 合法 Sprite，专门给 DisplacementFilter 用
  const displaceSprite = Sprite.from(flowRT);
  displaceSprite.anchor.set(0.5);
  displaceSprite.x = window.innerWidth / 2;
  displaceSprite.y = window.innerHeight / 2;
  displaceSprite.alpha = 0;
  app.stage.addChild(displaceSprite);

  // 核心参数
  const displacementFilter = new DisplacementFilter(displaceSprite);
  displacementFilter.scale.set(3, 3);
  bg.filters = enabledConfig.liquidDisplacement ? [displacementFilter] : [];

  // ===== 鼠标输入 =====
  let mouseX = 0;
  let mouseY = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let isPointerMoving = false;

  window.addEventListener('pointermove', (e) => {
    // 始终更新鼠标坐标，即使效果暂时关闭（转场期间）
    // 确保效果重开时 mouseX/Y 是真实值，避免从 0 跳到实际位置产生抖动
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;

    if (!enabledConfig.mouseParallax && !enabledConfig.tunnelScale) return;

    isPointerMoving =
      Math.abs(e.clientX - lastPointerX) > 0.5 ||
      Math.abs(e.clientY - lastPointerY) > 0.5;

    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  });

  // ===== 相机位移：背景和位移图各自跟随同一个目标 =====
  // 缩短时长到 0.5，使用 expo.out。你会发现它变得非常"跟手"
  const followConfig = {
    duration: 0.5,
    ease: 'expo.out',
  };

  let camXTo = gsap.quickTo(bg, 'x', followConfig);
  let camYTo = gsap.quickTo(bg, 'y', followConfig);

  // 【关键：景深感】
  // 让位移图（Displacement Sprite）的跟随速度比背景更"慢半拍"
  let displaceXTo = gsap.quickTo(displaceSprite, 'x', {
    duration: 0.7,
    ease: 'power2.out',
  });

  let displaceYTo = gsap.quickTo(displaceSprite, 'y', {
    duration: 0.7,
    ease: 'power2.out',
  });

  // 缩放也可以加一点缓冲
  let scaleXTo = gsap.quickTo(bg.scale, 'x', {
    duration: 0.6,
    ease: 'power2.out',
  });

  let scaleYTo = gsap.quickTo(bg.scale, 'y', {
    duration: 1.0,
    ease: 'power2.out',
  });

  // ===== 流动状态 =====
  let frameCount = 0;
  // 控制抖动频率：每多少帧跳跃一次。
  // 1 = 每一帧都跳（最高频，像雪花屏）
  // 14 = 略降频以减轻 CPU/GPU，仍保留手绘定格感
  const jitterSpeed = 14;

  // 离屏 flow 每 2 帧画一次，位移图沿用上一帧 RT（液体略降频、省一半 pass）
  let flowRTEveryNFrames = 0;

  // ===== ticker =====
  app.ticker.add(() => {
    // --- A. 手绘定格抖动 (Boiling Lines) ---
    if (enabledConfig.boilingLines) {
      frameCount++;
      if (frameCount % jitterSpeed === 0) {
        // 随机跳跃，模拟手绘线条的微动
        flowMap.tilePosition.x = Math.random() * 1000;
        flowMap.tilePosition.y = Math.random() * 1000;
      }
      if (frameCount > 1000) frameCount = 0;
    }

    // --- B. 离屏渲染（液体扰动必须）---
    if (enabledConfig.liquidDisplacement) {
      flowRTEveryNFrames++;
      if (flowRTEveryNFrames % 2 === 0) {
        app.renderer.render({
          container: flowContainer,
          target: flowRT,
          clear: true,
        });
      }
    }

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // --- C. 相机位移（鼠标视差）---
    if (enabledConfig.mouseParallax) {
      // 静止基准 y：图一为偏下的 sceneBaseY，图二为屏幕中心
      const baseY = sceneBaseY ?? centerY;

      // 使用 normalSafeMaxX/Y（固定基于 1x 缩放），确保图一和图二的视觉位移量一致
      const targetX = centerX - mouseX * normalSafeMaxX * 0.7;
      const targetY = baseY - mouseY * normalSafeMaxY * 0.7;

      const dispTargetX = centerX - mouseX * normalSafeMaxX;
      const dispTargetY = baseY - mouseY * normalSafeMaxY;

      camXTo(targetX);
      camYTo(targetY);
      displaceXTo(dispTargetX);
      displaceYTo(dispTargetY);
    }

    // --- D. 隧道缩放 ---
    if (enabledConfig.tunnelScale) {
      // 计算缩放：(1 - dist * 0.02) 实现外移缩小的隧道感
      const dist = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
      const currentBase = getBaseScale();
      const dynamicScale = currentBase * (1 - dist * 0.02);

      scaleXTo(dynamicScale);
      scaleYTo(dynamicScale);
    }

    // 重置移动状态开关（可选）
    if (enabledConfig.mouseParallax || enabledConfig.tunnelScale) {
      isPointerMoving = false;
    }
  });

  // ===== resize =====
  window.addEventListener('resize', () => {
    flowMap.width = window.innerWidth + 800;
    flowMap.height = window.innerHeight + 800;

    flowRT.resize(window.innerWidth + 800, window.innerHeight + 800);

    coverBackground();

    // 位移图和背景重新对齐到中心
    displaceSprite.x = bg.x;
    displaceSprite.y = bg.y;
  });

  // ===== 配置控制 =====
  function setConfig(next: Partial<MuseumBackgroundConfig>): void {
    const wasParallax = enabledConfig.mouseParallax;
    enabledConfig = { ...enabledConfig, ...next };
    bg.filters = enabledConfig.liquidDisplacement ? [displacementFilter] : [];
    // 关闭 mouseParallax 时，停止 displaceSprite 的残留 tween 并 snap 到 bg 位置
    // 避免转场期间位移图继续漂移，造成 displacement filter 扭曲
    if (wasParallax && !enabledConfig.mouseParallax) {
      gsap.killTweensOf(displaceSprite);
      displaceSprite.x = bg.x;
      displaceSprite.y = bg.y;
    }
  }

  function getConfig(): MuseumBackgroundConfig {
    return { ...enabledConfig };
  }

  // 设置场景基础参数，供不同页面/状态切换时调用
  // scaleMultiplier：缩放倍率（图一传 2.0，图二传 1.0）
  // baseY：鼠标视差静止中心 y（不传则恢复屏幕中心）
  // snapBg：是否立即 snap bg 位置和缩放（默认 true；转场结束时传 false 避免突变）
  function setSceneParams(scaleMultiplier: number, baseY?: number, snapBg = true): void {
    sceneScaleMultiplier = scaleMultiplier;
    sceneBaseY = baseY ?? null;
    if (snapBg) {
      // 完整重算并立即 snap bg 到新位置（页面初始化 / 页面跳转时用）
      coverBackground();
      displaceSprite.x = bg.x;
      displaceSprite.y = bg.y;
    } else {
      // 只更新 safeMax，不移动 bg（转场后平滑过渡用）
      // multiplier = 1.0 时，safeMax 与 normalSafeMax 相同，直接复用
      safeMaxX = normalSafeMaxX;
      safeMaxY = normalSafeMaxY;
    }
  }

  // 切换主背景图；扰动层、场景参数、四个开关均保持不变
  async function switchBackground(imagePath: string): Promise<void> {
    const newTexture = await Assets.load(imagePath);
    bg.texture = newTexture;
    // 新图尺寸可能不同，重新计算缩放和安全边距
    coverBackground();
    displaceSprite.x = bg.x;
    displaceSprite.y = bg.y;
  }

  // 将鼠标状态归零，避免重新开启 tunnelScale 时首帧基于偏角鼠标位置产生突变
  function resetMouseState(): void {
    mouseX = 0;
    mouseY = 0;
    lastPointerX = 0;
    lastPointerY = 0;
    isPointerMoving = false;
  }

  // 重建所有 quickTo 函数（转场用 overwrite:true 杀掉旧 tween 后调用，确保图二效果正常）
  function reinitQuickTo(): void {
    // 只 snap displaceSprite 到 bg 当前位置（转场结束时 bg 在屏幕中心）
    // bg.x/y 和 bg.scale 保持 GSAP 转场结束时的精确值，不做任何额外 snap
    displaceSprite.x = bg.x;
    displaceSprite.y = bg.y;

    camXTo = gsap.quickTo(bg, 'x', followConfig);
    camYTo = gsap.quickTo(bg, 'y', followConfig);
    displaceXTo = gsap.quickTo(displaceSprite, 'x', { duration: 0.7, ease: 'power2.out' });
    displaceYTo = gsap.quickTo(displaceSprite, 'y', { duration: 0.7, ease: 'power2.out' });
    scaleXTo = gsap.quickTo(bg.scale, 'x', { duration: 0.6, ease: 'power2.out' });
    scaleYTo = gsap.quickTo(bg.scale, 'y', { duration: 1.0, ease: 'power2.out' });
    // 用当前值预热，激活 tween，不触发任何位置或缩放变化
    camXTo(bg.x);
    camYTo(bg.y);
    displaceXTo(displaceSprite.x);
    displaceYTo(displaceSprite.y);
    scaleXTo(bg.scale.x);
    scaleYTo(bg.scale.y);
  }

  // 强制渲染一帧，再等浏览器真正呈现后通知外部。
  // 这样首页的加载底色会在背景首帧出现后再淡出，不会先露出 vignette。
  requestAnimationFrame(() => {
    app.renderer.render({ container: app.stage });
    requestAnimationFrame(() => {
      resolveFirstFrame();
    });
  });

  return {
    app,
    bg,
    firstFrameReady,
    getBaseScale,
    getNormalBaseScale,
    getNormalSafeMaxY: () => normalSafeMaxY,
    coverBackground,
    setConfig,
    getConfig,
    setSceneParams,
    switchBackground,
    resetMouseState,
    reinitQuickTo,
  };
}
