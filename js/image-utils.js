/**
 * My fav - 画像ユーティリティ
 * クライアント側での自動リサイズ・WebP圧縮を行い、容量を大幅に節約します
 */

const ImageUtils = {
  /**
   * 画像ファイルをリサイズ＆圧縮してBase64で取得
   */
  async compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;

          // アスペクト比を維持してリサイズ計算
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let format = 'image/webp';
          let dataUrl = canvas.toDataURL(format, quality);

          if (dataUrl.startsWith('data:image/png') && file.type !== 'image/png') {
            format = 'image/jpeg';
            dataUrl = canvas.toDataURL(format, quality);
          }

          const compressedSize = Math.round((dataUrl.length * 3) / 4);

          resolve({
            dataUrl,
            originalSize: file.size,
            compressedSize,
            width,
            height,
            format
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * アバター用のズーム・位置調整対応の正方形切り抜き＆圧縮
   * @param {string|File|HTMLImageElement} imageSource
   * @param {number} zoom 1.0 - 3.0
   * @param {number} offsetX -100 to 100
   * @param {number} offsetY -100 to 100
   * @param {number} size 出力ピクセルサイズ (デフォルト 500)
   */
  async cropCustomAvatar(imageSource, zoom = 1.0, offsetX = 0, offsetY = 0, size = 500) {
    return new Promise((resolve, reject) => {
      const processImage = (img) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const baseDim = Math.min(img.width, img.height);
        // zoom倍率（1.0〜3.0）でクロップ領域を縮小（＝ズームイン）
        const cropDim = baseDim / Math.max(1, zoom);

        // 中央位置にオフセットを加味
        const maxOffsetX = (img.width - cropDim) / 2;
        const maxOffsetY = (img.height - cropDim) / 2;

        const sx = ((img.width - cropDim) / 2) + (offsetX / 100 * maxOffsetX);
        const sy = ((img.height - cropDim) / 2) + (offsetY / 100 * maxOffsetY);

        // クランプ（はみ出し防止）
        const clampedSx = Math.max(0, Math.min(img.width - cropDim, sx));
        const clampedSy = Math.max(0, Math.min(img.height - cropDim, sy));

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, clampedSx, clampedSy, cropDim, cropDim, 0, 0, size, size);

        resolve(canvas.toDataURL('image/webp', 0.88));
      };

      if (typeof imageSource === 'string') {
        const img = new Image();
        img.onload = () => processImage(img);
        img.onerror = reject;
        img.src = imageSource;
      } else if (imageSource instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => processImage(img);
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageSource);
      } else if (imageSource instanceof HTMLImageElement) {
        processImage(imageSource);
      }
    });
  },

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
};
