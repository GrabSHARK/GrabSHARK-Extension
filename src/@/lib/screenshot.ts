import browser from 'webextension-polyfill';
const loadImage = (blob: Blob): Promise<ImageBitmap> => createImageBitmap(blob);

const drawImagesOnCanvas = async (
  blobs: Blob[],
  viewportWidth: number,
  viewportHeight: number,
  totalHeight: number,
  dpr: number
): Promise<Blob> => {
  const canvas = new OffscreenCanvas(viewportWidth * dpr, totalHeight * dpr);
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Failed to get canvas context.');

  ctx.scale(dpr, dpr);
  let currentHeight = 0;

  for (let index = 0; index < blobs.length - 1; index++) {
    const img = await loadImage(blobs[index]);
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, currentHeight, viewportWidth, viewportHeight);
    currentHeight += viewportHeight;
  }

  const remainingHeight = totalHeight - currentHeight;
  if (remainingHeight > 0) {
    const lastImage = await loadImage(blobs[blobs.length - 1]);
    const cropTop = (viewportHeight - remainingHeight) * dpr;
    ctx.drawImage(lastImage, 0, cropTop, lastImage.width, remainingHeight * dpr, 0, currentHeight, viewportWidth, remainingHeight);
  }

  return await canvas.convertToBlob({ type: 'image/png' });
};

async function executeScript(tabId: number, func: any, args: any[] = []) {
  if (typeof chrome.scripting !== 'undefined') {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
    });
    return results[0]?.result;
  } else {
    const results = await browser.tabs.executeScript(tabId, {
      code: `(${func})(${args.map((arg) => JSON.stringify(arg)).join(',')})`,
    });
    return results[0];
  }
}

interface CaptureOptions {
  onCancel?: () => void; // Called when ESC is pressed
}

async function captureFullPageScreenshot(options?: CaptureOptions): Promise<Blob> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id) {
    throw new Error('Unable to get the current tab.');
  }

  // ESC key detection - inject listener into page
  let cancelled = false;

  const addEscListener = () => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        (window as any).__grabsharkCaptureCancel = true;
        e.preventDefault();
      }
    };
    (window as any).__grabsharkCaptureHandler = handler;
    (window as any).__grabsharkCaptureCancel = false;
    document.addEventListener('keydown', handler);
  };

  const removeEscListener = () => {
    const handler = (window as any).__grabsharkCaptureHandler;
    if (handler) {
      document.removeEventListener('keydown', handler);
      delete (window as any).__grabsharkCaptureHandler;
    }
    delete (window as any).__grabsharkCaptureCancel;
  };

  const checkCancelled = () => {
    return (window as any).__grabsharkCaptureCancel === true;
  };

  const addHideScrollbarClass = () => {
    const style = document.createElement('style');
    style.id = 'hide-scrollbar-style';
    style.textContent = `
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);
    document.documentElement.classList.add('hide-scrollbar');
    document.body.classList.add('hide-scrollbar');
  };

  const removeHideScrollbarClass = () => {
    const style = document.getElementById('hide-scrollbar-style');
    if (style) style.remove();
    document.documentElement.classList.remove('hide-scrollbar');
    document.body.classList.remove('hide-scrollbar');
  };

  const adjustFixedElements = () => {
    const elements = Array.from(document.querySelectorAll('*'));
    const originalStyles = elements
      .filter((el) => {
        const cs = getComputedStyle(el);
        return ['fixed', 'sticky'].includes(cs.position);
      })
      .map((el) => ({
        selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
        position: (el as any).style.position,
      }));

    elements.forEach((el) => {
      const cs = getComputedStyle(el);
      if (['fixed', 'sticky'].includes(cs.position)) {
        (el as any).style.position = 'relative';
      }
    });

    return originalStyles;
  };

  const restoreFixedElements = (
    originalStyles: { selector: string; position: string | null }[]
  ) => {
    originalStyles.forEach(({ selector, position }) => {
      const element = document.querySelector(selector);
      if (element) {
        (element as HTMLElement).style.position = position || '';
      }
    });
  };

  const addDisableSmoothScrollbarClass = () => {
    const style = document.createElement('style');
    style.id = 'disable-smooth-scroll-style';
    style.textContent = `
      .disable-smooth-scroll {
        scroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);

    document.documentElement.classList.add('disable-smooth-scroll');
    document.body.classList.add('disable-smooth-scroll');
  };

  const removeDisableSmoothScrollbarClass = () => {
    const style = document.getElementById('disable-smooth-scroll-style');
    if (style) style.remove();

    document.documentElement.classList.remove('disable-smooth-scroll');
    document.body.classList.remove('disable-smooth-scroll');
  };

  // Setup
  await executeScript(tab.id, addEscListener);
  await executeScript(tab.id, addHideScrollbarClass);
  const originalStyles = await executeScript(tab.id, adjustFixedElements);
  await executeScript(tab.id, addDisableSmoothScrollbarClass);

  const totalHeight = (await executeScript(
    tab.id,
    () => document.documentElement.scrollHeight
  )) as number;
  const viewportHeight = (await executeScript(
    tab.id,
    () => window.innerHeight
  )) as number;
  const viewportWidth = (await executeScript(
    tab.id,
    () => window.innerWidth
  )) as number;
  const dpr = (await executeScript(
    tab.id,
    () => window.devicePixelRatio
  )) as number;

  const numShots = Math.ceil(totalHeight / viewportHeight);

  const blobs: Blob[] = [];
  let capturedHeight = 0;

  for (let i = 0; i < numShots; i++) {
    // Check for ESC cancellation
    cancelled = await executeScript(tab.id, checkCancelled) as boolean;
    if (cancelled) { if (options?.onCancel) options.onCancel(); break; }

    const currentScroll =
      i < numShots - 1 ? i * viewportHeight : totalHeight - viewportHeight;

    const finalScroll = currentScroll < 0 ? 0 : currentScroll;

    const didScroll = await executeScript(
      tab.id,
      (pos: any) => {
        if (Math.abs(window.scrollY - pos) > 2) {
          document.documentElement.style.scrollBehavior = 'auto';
          window.scrollTo(0, pos);
          return true;
        }
        return false;
      },
      [finalScroll]
    );

    if (didScroll) {
      await new Promise((r) => setTimeout(r, 500));
    } else {
      // Small buffer if no scroll needed
      await new Promise((r) => setTimeout(r, 100));
    }

    const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId!, {
      format: 'png',
    });
    const blob = await fetch(dataUrl).then((res) => res.blob());
    blobs.push(blob);

    // Track how much we've actually captured
    if (i < numShots - 1) {
      capturedHeight += viewportHeight;
    } else {
      capturedHeight = totalHeight;
    }
  }

  // Cleanup - scroll instantly back to top
  await executeScript(
    tab.id,
    () => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
    }
  );

  // Notify that capture phase is done and processing is starting
  if (tab.id) {
    browser.tabs.sendMessage(tab.id, {
      type: 'LINK_SAVE_PROGRESS',
      status: 'uploading'
    }).catch(() => { });
  }

  await executeScript(tab.id, removeEscListener);
  await executeScript(tab.id, removeHideScrollbarClass);
  await executeScript(tab.id, restoreFixedElements, [originalStyles]);
  await executeScript(tab.id, removeDisableSmoothScrollbarClass);

  // If cancelled early, calculate actual captured height
  const actualHeight = cancelled ? capturedHeight : totalHeight;

  // If we have no blobs, throw error
  if (blobs.length === 0) {
    throw new Error('No screenshots captured.');
  }

  const resultBlob = await drawImagesOnCanvas(
    blobs,
    viewportWidth,
    viewportHeight,
    actualHeight,
    dpr
  );

  return resultBlob;
}

export default captureFullPageScreenshot;
