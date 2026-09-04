import { API_BASE_URL } from '../shared/api';
import type { ApiResult } from '../shared/api';
import type { GlobalSearchResult, MessageSearchResult } from '../shared/search';
import {
  normalizeGlobalSearch,
  normalizeMessageSearch,
  normalizeUserSearch,
} from '../shared/search';
import type { SearchPerson } from '../shared/search';
import { apiGet } from './apiRequest';

export async function fetchGlobalSearch(
  token: string,
  query: string,
): Promise<ApiResult<GlobalSearchResult>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/search?q=${encodeURIComponent(query)}`,
    token,
    'Global Search API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeGlobalSearch(result.data) };
}

export async function fetchUserSearch(
  token: string,
  query: string,
): Promise<ApiResult<SearchPerson[]>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`,
    token,
    'User Search API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeUserSearch(result.data) };
}

export async function fetchMessageSearch(
  token: string,
  conversationId: string,
  query: string,
): Promise<ApiResult<MessageSearchResult>> {
  const result = await apiGet<unknown>(
    `${API_BASE_URL}/conversations/${conversationId}/messages/search?q=${encodeURIComponent(query)}`,
    token,
    'Message Search API',
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, data: normalizeMessageSearch(result.data) };
}
