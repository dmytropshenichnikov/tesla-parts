/**
 * Обробка картинки ПЕРЕД завантаженням в адмінці:
 * 1) обрізаємо порожні поля навколо малюнка (часто це 25-30% з боків);
 * 2) світлий фон робимо чисто білим, щоб не було сірої плашки на картці.
 *
 * Так файл лягає на сервер уже чистим — магазин показує його одразу, без
 * будь-яких перемальовувань у браузері (і без миготіння "сіре -> біле").
 * Застосовується ЛИШЕ до картинок категорій і підкатегорій: креслення схем
 * чіпати не можна — координати точок прив'язані до оригінального зображення.
 */
const BACKGROUND_LUMA = 232;
const MAX_WHITEN_BG = 210; // темніший фон = фото, його не чіпаємо
const PADDING = 0.03;

export const trimImageFile = async (file: File): Promise<File> => {
  if (!file || !file.type.startsWith('image/')) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image load failed'));
      el.src = url;
    });

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) return file;

    const probeW = Math.min(naturalW, 420);
    const probeH = Math.max(1, Math.round((naturalH * probeW) / naturalW));
    const probe = document.createElement('canvas');
    probe.width = probeW;
    probe.height = probeH;
    const probeCtx = probe.getContext('2d');
    if (!probeCtx) return file;
    probeCtx.drawImage(img, 0, 0, probeW, probeH);
    const { data } = probeCtx.getImageData(0, 0, probeW, probeH);

    const cornerLuma = 0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2];
    if (cornerLuma < MAX_WHITEN_BG) return file; // це фото — не чіпаємо
    const whitenThreshold = cornerLuma - 8;
    const limit = Math.min(BACKGROUND_LUMA, whitenThreshold);

    let minX = probeW;
    let minY = probeH;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < probeH; y += 1) {
      for (let x = 0; x < probeW; x += 1) {
        const i = (y * probeW + x) * 4;
        if (data[i + 3] < 30) continue;
        const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (luma < limit) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0 || maxY < 0) return file;

    const padX = Math.round(probeW * PADDING);
    const padY = Math.round(probeH * PADDING);
    minX = Math.max(0, minX - padX);
    minY = Math.max(0, minY - padY);
    maxX = Math.min(probeW - 1, maxX + padX);
    maxY = Math.min(probeH - 1, maxY + padY);

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const nothingToCrop = cropW > probeW * 0.96 && cropH > probeH * 0.96;
    const alreadyWhite = cornerLuma >= 250;
    if (nothingToCrop && alreadyWhite) return file;

    const scale = naturalW / probeW;
    const out = document.createElement('canvas');
    out.width = Math.round(cropW * scale);
    out.height = Math.round(cropH * scale);
    const outCtx = out.getContext('2d');
    if (!outCtx) return file;
    outCtx.drawImage(img, minX * scale, minY * scale, cropW * scale, cropH * scale, 0, 0, out.width, out.height);

    const imgData = outCtx.getImageData(0, 0, out.width, out.height);
    const px = imgData.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      const luma = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (luma >= whitenThreshold) {
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
        px[i + 3] = 255;
      }
    }
    outCtx.putImageData(imgData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], baseName + '.png', { type: 'image/png' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
};

export default trimImageFile;
