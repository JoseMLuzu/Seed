/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function getAccountInitials(name: string, email: string) {
  const source = name.trim() || email.trim() || "Jardinero Digital";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function resizeProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("invalid-image"));
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxSize = 512;
      const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(imageUrl);
        reject(new Error("canvas-unavailable"));
        return;
      }

      context.fillStyle = "#f5f5f7";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(imageUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("image-load-failed"));
    };
    image.src = imageUrl;
  });
}
