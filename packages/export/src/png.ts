export interface PngFile {
  name: string;
  blob: Blob;
}

/** Package multiple PNG blobs into a zip when more than one frame is exported. */
export async function packPngExports(files: PngFile[]): Promise<Blob> {
  if (files.length === 0) {
    return new Blob([], { type: 'image/png' });
  }
  if (files.length === 1) {
    return files[0]!.blob;
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const file of files) {
    zip.file(sanitizeFilename(file.name) + '.png', file.blob);
  }
  return zip.generateAsync({ type: 'blob' });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 64) || 'export';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function suggestPngFilename(baseName: string, multiple: boolean): string {
  return multiple ? `${baseName}.zip` : `${baseName}.png`;
}
