/**
 * FLOW-08: imageService.uploadProductImage is now wired into the admin
 * ProductForm — lock in its validation contract (type/size/path safety).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadMock = vi.fn();
const getPublicUrlMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    storage: {
      from: vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock })),
    },
  },
}));

import { uploadProductImage } from '../../services/imageService';

function makeFile(type: string, bytes: number, name = 'shot.jpg') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('uploadProductImage (FLOW-08)', () => {
  beforeEach(() => {
    uploadMock.mockReset().mockResolvedValue({ error: null });
    getPublicUrlMock.mockReset().mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/products/tee/navy/01-front.jpg' },
    });
  });

  it('rejects disallowed file types', async () => {
    const result = await uploadProductImage(makeFile('image/gif', 100), 'tee', 'navy', '01-front');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid file type');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('rejects files over 5MB', async () => {
    const result = await uploadProductImage(
      makeFile('image/jpeg', 6 * 1024 * 1024),
      'tee',
      'navy',
      '01-front',
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File too large');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('rejects unsafe slug/color values (path traversal)', async () => {
    const file = makeFile('image/jpeg', 100);
    const badSlug = await uploadProductImage(file, '../etc', 'navy', '01-front');
    expect(badSlug.success).toBe(false);
    const badColor = await uploadProductImage(file, 'tee', 'navy/../../x', '01-front');
    expect(badColor.success).toBe(false);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('uploads to the documented path and returns the public URL', async () => {
    const result = await uploadProductImage(
      makeFile('image/webp', 512),
      'classic-tee',
      'navy-blue',
      '01-front',
    );

    expect(result).toEqual({
      success: true,
      url: 'https://cdn.example.com/products/tee/navy/01-front.jpg',
    });
    expect(uploadMock).toHaveBeenCalledWith(
      'products/classic-tee/navy-blue/01-front.jpg',
      expect.any(File),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('surfaces storage upload errors', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'Row-level security policy violated' } });
    const result = await uploadProductImage(makeFile('image/png', 200), 'tee', 'navy', '01-front');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Row-level security policy violated');
  });
});
