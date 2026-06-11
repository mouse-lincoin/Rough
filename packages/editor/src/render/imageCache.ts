import { LRUCache } from 'lru-cache';
import { getAssetBlob } from '@rough/document';
import type { ID } from '@rough/schema';

export class ImageCache {
  private cache = new LRUCache<ID, ImageBitmap>({ max: 200 });
  private loading = new Map<ID, Promise<ImageBitmap | null>>();

  get(assetId: ID): ImageBitmap | undefined {
    return this.cache.get(assetId);
  }

  load(assetId: ID): Promise<ImageBitmap | null> {
    const cached = this.cache.get(assetId);
    if (cached) return Promise.resolve(cached);

    const pending = this.loading.get(assetId);
    if (pending) return pending;

    const promise = getAssetBlob(assetId)
      .then(async (blob) => {
        if (!blob) return null;
        const bitmap = await createImageBitmap(blob);
        this.cache.set(assetId, bitmap);
        return bitmap;
      })
      .catch(() => null)
      .finally(() => {
        this.loading.delete(assetId);
      });

    this.loading.set(assetId, promise);
    return promise;
  }
}
