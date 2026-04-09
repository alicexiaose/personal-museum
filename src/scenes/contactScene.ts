export function createContactScene() {
  /** 整块联系内容的外层容器（相对 overlay 内容区水平垂直居中） */
  let centerWrap: HTMLDivElement | null = null;

  function unmount(): void {
    centerWrap?.remove();
    centerWrap = null;
  }

  function mount(ctx: { contentHost: HTMLDivElement; gradientHost: HTMLDivElement }): void {
    unmount();

    centerWrap = document.createElement('div');
    centerWrap.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: min(90vh, 820px);
      box-sizing: border-box;
    `;

    // 邮票主体：底图 + 内部叠层统一在一个容器里，方便和对中层对齐
    const stampBox = document.createElement('div');
    stampBox.style.cssText = `
      position: relative;
      width: 320px;
      height: 320px;
      flex-shrink: 0;
    `;

    const bgImg = document.createElement('img');
    bgImg.src = '/icon/bgContact.svg';
    bgImg.alt = '';
    bgImg.style.cssText = `
      position: absolute;
      inset: 0;
      width: 320px;
      height: 320px;
      object-fit: fill;
      pointer-events: none;
    `;
    stampBox.appendChild(bgImg);

    const innerStack = document.createElement('div');
    innerStack.style.cssText = `
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    `;

    // 二维码区域黄色底 476×370，内嵌拉伸后的二维码 476×342
    const yellowBlock = document.createElement('div');
    yellowBlock.style.cssText = `
      width: 284px;
      height: 220px;
      box-sizing: border-box;
      background: #FFD967;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;

    const qrImg = document.createElement('img');
    qrImg.src = '/pic/pic_QR.png';
    qrImg.alt = '二维码';
    qrImg.style.cssText = `
      width: 284px;
      height: 202px;
      object-fit: fill;
      display: block;
    `;
    yellowBlock.appendChild(qrImg);

    const scanImg = document.createElement('img');
    scanImg.src = '/icon/icon_ScanCode.svg';
    scanImg.alt = '';
    scanImg.style.cssText = `
      height: 38px;
      width: auto;
      display: block;
      flex-shrink: 0;
      margin-top: 14px;
    `;

    innerStack.appendChild(yellowBlock);
    innerStack.appendChild(scanImg);
    stampBox.appendChild(innerStack);
    centerWrap.appendChild(stampBox);

    ctx.contentHost.appendChild(centerWrap);
  }

  return { mount, unmount };
}
