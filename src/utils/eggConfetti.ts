export interface ConfettiOptions {
  count?: number;
  x?: number;
  y?: number;
  randX?: number;
  randY?: number;
  speedX?: number;
  speedY?: number;
  speedRandX?: number;
  speedRandY?: number;
  gravity?: number;
  size?: number;
  sizeRand?: number;
}

export function confetti($parent: HTMLElement, {
  count = 100,
  x = 50,
  y = 50,
  randX = 10,
  randY = 10,
  speedX = 0,
  speedY = -2,
  speedRandX = 0.5,
  speedRandY = 0.5,
  gravity = 0.01,
  size = 10,
  sizeRand = 5
}: ConfettiOptions = {}) {
  const $container = document.createElement('div');
  $container.classList.add('confetti');

  interface Particle {
    dom: HTMLSpanElement;
    x: number;
    y: number;
    speedX: number;
    speedY: number;
    size: number;
  }

  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const $particle = document.createElement('span');

    const settings: Particle = {
      dom: $particle,
      x: x + Math.random() * randX * 2 - randX,
      y: y + Math.random() * randY * 2 - randY,
      speedX: speedX + Math.random() * speedRandX * 2 - speedRandX,
      speedY: speedY + Math.random() * speedRandY * 2 - speedRandY,
      size: size + Math.random() * sizeRand * 2 - sizeRand
    };

    $particle.style.backgroundColor = `hsl(${Math.random() * 360}deg, 80%, 60%)`;
    $particle.style.setProperty('--rx', String(Math.random() * 2 - 1));
    $particle.style.setProperty('--ry', String(Math.random() * 2 - 1));
    $particle.style.setProperty('--rz', String(Math.random() * 2 - 1));
    $particle.style.setProperty('--rs', String(Math.random() * 2 + 0.5));
    particles.push(settings);
    $container.appendChild($particle);
  }

  const update = () => {
    particles.forEach((config, i) => {
      if (config.y > 100) {
        particles.splice(i, 1);
        config.dom.remove();
      }

      config.dom.style.setProperty('--size', String(config.size));
      config.dom.style.left = config.x + '%';
      config.dom.style.top = config.y + '%';
      config.x += config.speedX;
      config.y += config.speedY;
      config.speedY += gravity;
    });

    if (particles.length) {
      requestAnimationFrame(update);
    } else {
      $container.remove();
    }
  };

  update();

  $parent.insertAdjacentElement('beforeend', $container);
}

export function fireConfetti(): void {
  const appElement = document.getElementById('app');
  if (!appElement) return;

  confetti(appElement, {
    count: 150,
    randX: 20,
    randY: 20,
    speedRandX: 1,
    speedRandY: 1,
    gravity: 0.02,
    size: 8,
    sizeRand: 4
  });
}

export function fireMultipleConfetti(): void {
  setTimeout(() => fireConfetti(), 0);
  setTimeout(() => fireConfetti(), 200);
  setTimeout(() => fireConfetti(), 400);
}
