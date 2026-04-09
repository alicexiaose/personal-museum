export function createInfoScene() {
  let gradientLayer: HTMLDivElement | null = null;
  let infoP1: HTMLParagraphElement | null = null;
  let infoGap: HTMLDivElement | null = null;
  let infoP2: HTMLParagraphElement | null = null;

  function unmount(): void {
    gradientLayer?.remove();
    infoP1?.remove();
    infoGap?.remove();
    infoP2?.remove();
    gradientLayer = null;
    infoP1 = null;
    infoGap = null;
    infoP2 = null;
  }

  function mount(ctx: { gradientHost: HTMLDivElement; contentHost: HTMLDivElement }): void {
    unmount();

    gradientLayer = document.createElement('div');
    // 单层径向 + blur：椭圆按设计约 160×260，inset:0 避免 overlay overflow 裁切
    gradientLayer.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(
        ellipse 180px 300px at 50% 46%,
        rgba(194, 154, 23, 0.48) 0%,
        rgba(194, 154, 23, 0.16) 40%,
        rgba(194, 154, 23, 0.045) 62%,
        rgba(30, 30, 26, 0) 80%
      );
      filter: blur(30px);
    `;
    ctx.gradientHost.appendChild(gradientLayer);

    infoP1 = document.createElement('p');
    infoP1.style.cssText = `
      margin: 0;
      font-size: 28px;
      line-height: 1.5;
      color: #FFDB70;
      font-weight: 300;
    `;
    infoP1.innerHTML = `本网站是由作者通过 <span class="overlay-cinzel">Vibe Coding</span> 工具生成，仅作为能力经验和作品的展示。`;

    infoGap = document.createElement('div');
    infoGap.style.cssText = 'height: 26px;';

    infoP2 = document.createElement('p');
    infoP2.style.cssText = `
      margin: 0;
      font-size: 28px;
      line-height: 1.5;
      color: #FFF0C2;
      font-weight: 300;
    `;
    infoP2.innerHTML = `本网站使用了 <span class="overlay-cinzel">ChatGPT</span>、<span class="overlay-cinzel">Cursor</span>、<span class="overlay-cinzel">Gemini</span>、<span class="overlay-cinzel">Lovart</span>、<span class="overlay-cinzel">Figma</span>、星流等工具共同完成。`;

    ctx.contentHost.appendChild(infoP1);
    ctx.contentHost.appendChild(infoGap);
    ctx.contentHost.appendChild(infoP2);
  }

  return { mount, unmount };
}

