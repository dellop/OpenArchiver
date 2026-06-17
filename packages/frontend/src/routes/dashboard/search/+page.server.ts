import type { PageServerLoad, RequestEvent } from './$types';
import { api } from '$lib/server/api';
import type { SearchResult, SearchSortBy, SearchSortDirection } from '@open-archiver/types';

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
	'sortBy',
	'sortDirection',
] as const;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 500;
const ALLOWED_SORT_FIELDS = new Set<SearchSortBy>([
	'timestamp',
	'subject',
	'from',
	'toSort',
	'userEmail',
	'attachmentCount',
]);
const ALLOWED_SORT_DIRECTIONS = new Set<SearchSortDirection>(['asc', 'desc']);

function getPageLimit(searchParams: URLSearchParams) {
	const parsed = parseInt(searchParams.get('limit') || `${DEFAULT_LIMIT}`, 10);
	if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
	return Math.min(parsed, MAX_LIMIT);
}

function getSortBy(searchParams: URLSearchParams): SearchSortBy {
	const sortBy = searchParams.get('sortBy') as SearchSortBy | null;
	return sortBy && ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'timestamp';
}

function getSortDirection(searchParams: URLSearchParams): SearchSortDirection {
	const sortDirection = searchParams.get('sortDirection') as SearchSortDirection | null;
	return sortDirection && ALLOWED_SORT_DIRECTIONS.has(sortDirection) ? sortDirection : 'desc';
}

async function performSearch(
	searchParams: URLSearchParams,
	page: number,
	limit: number,
	sortBy: SearchSortBy,
	sortDirection: SearchSortDirection,
	event: RequestEvent
) {
	const hasCriteria = SEARCH_PARAM_NAMES.some((name) => {
		if (name === 'matchingStrategy' || name === 'limit' || name.startsWith('sort')) {
			return false;
		}
		return Boolean(searchParams.get(name)?.trim());
	});
	const matchingStrategy = (searchParams.get('matchingStrategy') || 'last') as MatchingStrategy;

	if (!hasCriteria) {
		return {
			searchResult: null,
			searchParams: Object.fromEntries(searchParams),
			page: 1,
			limit,
			sortBy,
			sortDirection,
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
		params.set('sortBy', sortBy);
		params.set('sortDirection', sortDirection);

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
				sortBy,
				sortDirection,
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
			sortBy,
			sortDirection,
			matchingStrategy,
		};
	} catch (error) {
		return {
			searchResult: null,
			searchParams: Object.fromEntries(searchParams),
			page,
			limit,
			sortBy,
			sortDirection,
			matchingStrategy,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

export const load: PageServerLoad = async (event) => {
	const page = parseInt(event.url.searchParams.get('page') || '1');
	const limit = getPageLimit(event.url.searchParams);
	const sortBy = getSortBy(event.url.searchParams);
	const sortDirection = getSortDirection(event.url.searchParams);
	return performSearch(event.url.searchParams, page, limit, sortBy, sortDirection, event);
};
