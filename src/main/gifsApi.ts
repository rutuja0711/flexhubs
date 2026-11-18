import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import type { GifCategoryItem, GifPickerItem } from '../shared/gifs';
import { normalizeGifCategories, normalizeGifItems } from '../shared/gifs';
import { apiGet } from './apiRequest';

async function fetchGifList(
  token: string,
  path: string,
  label: string,
): Promise<ApiResult<GifPickerItem[]>> {
  const result = await apiGet<unknown>(`${API_BASE_URL}${path}`, token, label);

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeGifItems(result.data) };
}

export async function fetchGifCategories(
  token: string,
  locale = 'en_US',
): Promise<ApiResult<GifCategoryItem[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/gifs/categories?locale=${encodeURIComponent(locale)}`,
    token,
    'GIF Categories API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeGifCategories(result.data) };
}

export async function fetchTrendingGifs(
  token: string,
  limit = 24,
): Promise<ApiResult<GifPickerItem[]>> {
  return fetchGifList(
    token,
    `/gifs/trending?limit=${encodeURIComponent(String(limit))}`,
    'Trending GIFs API',
  );
}

export async function searchGifs(
  token: string,
  query: string,
  limit = 24,
): Promise<ApiResult<GifPickerItem[]>> {
  return fetchGifList(
    token,
    `/gifs/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`,
    'Search GIFs API',
  );
}

export async function fetchTrendingStickers(
  token: string,
  limit = 24,
): Promise<ApiResult<GifPickerItem[]>> {
  return fetchGifList(
    token,
    `/gifs/stickers/trending?limit=${encodeURIComponent(String(limit))}`,
    'Trending Stickers API',
  );
}

export async function searchStickers(
  token: string,
  query: string,
  limit = 24,
): Promise<ApiResult<GifPickerItem[]>> {
  return fetchGifList(
    token,
    `/gifs/stickers/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`,
    'Search Stickers API',
  );
}
