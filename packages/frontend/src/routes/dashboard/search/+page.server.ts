import type { PageServerLoad, RequestEvent } from './$types';
import { api } from '$lib/server/api';
import type { SearchResult } from '@open-archiver/types';

import type { MatchingStrategy } from '@open-archiver/types';

const SEARCH_PARAM_NAMES = [
	'keywords',
	'from',
	'to',
	'cc',
	'bcc',
	'subject',
	'body',
	'attachmentFilename',
	'attachmentContent',
	'dateFrom',
	'dateTo',
	'matchingStrategy',
	'limit',
] as const;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 500;

function getPageLimit(searchParams: URLSearchParams) {
	const parsed = parseInt(searchParams.get('limit') || `${DEFAULT_LIMIT}`, 10);
	if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
	return Math.min(parsed, MAX_LIMIT);
}

async function performSearch(
	searchParams: URLSearchParams,
	page: number,
	limit: number,
	event: RequestEvent
) {
	const hasCriteria = SEARCH_PARAM_NAMES.some((name) => {
		if (name === 'matchingStrategy' || name === 'limit') return false;
		return Boolean(searchParams.get(name)?.trim());
	});
	const matchingStrategy = (searchParams.get('matchingStrategy') || 'last') as MatchingStrategy;

	if (!hasCriteria) {
		return {
			searchResult: null,
			searchParams: Object.fromEntries(searchParams),
			page: 1,
			limit,
			matchingStrategy,
		};
	}

	try {
		const params = new URLSearchParams();
		for (const name of SEARCH_PARAM_NAMES) {
			const value = searchParams.get(name);
			if (value?.trim()) {
				params.set(name, value.trim());
			}
		}
		params.set('page', page.toString());
		params.set('limit', limit.toString());

		const response = await api(`/search?${params.toString()}`, event, {
			method: 'GET',
		});

		if (!response.ok) {
			const error = await response.json();
			return {
				searchResult: null,
				searchParams: Object.fromEntries(searchParams),
				page,
				limit,
				matchingStrategy,
				error: error.message,
			};
		}

		const searchResult = (await response.json()) as SearchResult;
		return {
			searchResult,
			searchParams: Object.fromEntries(searchParams),
			page,
			limit,
			matchingStrategy,
		};
	} catch (error) {
		return {
			searchResult: null,
			searchParams: Object.fromEntries(searchParams),
			page,
			limit,
			matchingStrategy,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

export const load: PageServerLoad = async (event) => {
	const page = parseInt(event.url.searchParams.get('page') || '1');
	const limit = getPageLimit(event.url.searchParams);
	return performSearch(event.url.searchParams, page, limit, event);
};
