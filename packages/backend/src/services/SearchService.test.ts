import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';
import { SearchService, SearchValidationError } from './SearchService';
import { FilterBuilder } from './FilterBuilder';
import { SearchController } from '../api/controllers/search.controller';
import type { SearchParams, SearchResponse } from 'meilisearch';
import type { EmailDocument, SearchQuery } from '@open-archiver/types';

type SearchCall = {
	query: string;
	params: SearchParams;
};

function createService(calls: SearchCall[]) {
	const service = Object.create(SearchService.prototype) as any;

	service.getIndex = async () =>
		({
			search: async (query: string, params: SearchParams) => {
				calls.push({ query, params });
				return {
					query,
					hits: [],
					estimatedTotalHits: 0,
					processingTimeMs: 1,
				} as unknown as SearchResponse<EmailDocument>;
			},
		}) as any;
	service.auditService = { createAuditLog: async () => undefined };

	return service;
}

async function runSearch(dto: SearchQuery) {
	const calls: SearchCall[] = [];
	const service = createService(calls);
	await service.searchEmails(dto, 'user-1', '127.0.0.1');
	assert.equal(calls.length, 1);
	return calls[0];
}

function stubPermissionFilters(t: TestContext) {
	t.mock.method(FilterBuilder, 'create', async () => ({
		drizzleFilter: undefined,
		searchFilter: 'ingestionSourceId = "allowed-source"',
	}));
}

describe('SearchService advanced search', () => {
	it('searches body with an exact to filter', async (t) => {
		stubPermissionFilters(t);

		const call = await runSearch({
			query: '',
			fieldQueries: [{ attribute: 'body', query: 'contract renewal' }],
			filters: { to: ' Boss@Example.COM ' },
		});

		assert.equal(call.query, 'contract renewal');
		assert.deepEqual(call.params.attributesToSearchOn, ['body']);
		assert.match(String(call.params.filter), /to = 'boss@example\.com'/);
		assert.match(String(call.params.filter), /ingestionSourceId = "allowed-source"/);
	});

	it('searches body with an exact from filter', async (t) => {
		stubPermissionFilters(t);

		const call = await runSearch({
			query: '',
			fieldQueries: [{ attribute: 'body', query: 'invoice' }],
			filters: { from: ' Sender@Example.COM ' },
		});

		assert.equal(call.query, 'invoice');
		assert.deepEqual(call.params.attributesToSearchOn, ['body']);
		assert.match(String(call.params.filter), /from = 'sender@example\.com'/);
	});

	it('searches subject only', async (t) => {
		stubPermissionFilters(t);

		const call = await runSearch({
			query: '',
			fieldQueries: [{ attribute: 'subject', query: 'q4 report' }],
		});

		assert.equal(call.query, 'q4 report');
		assert.deepEqual(call.params.attributesToSearchOn, ['subject']);
	});

	it('searches attachment filenames only', async (t) => {
		stubPermissionFilters(t);

		const call = await runSearch({
			query: '',
			fieldQueries: [{ attribute: 'attachments.filename', query: 'invoice.pdf' }],
		});

		assert.equal(call.query, 'invoice.pdf');
		assert.deepEqual(call.params.attributesToSearchOn, ['attachments.filename']);
	});

	it('searches attachment content only', async (t) => {
		stubPermissionFilters(t);

		const call = await runSearch({
			query: '',
			fieldQueries: [{ attribute: 'attachments.content', query: 'purchase order' }],
		});

		assert.equal(call.query, 'purchase order');
		assert.deepEqual(call.params.attributesToSearchOn, ['attachments.content']);
	});

	it('adds timestamp filters for a date range', async (t) => {
		stubPermissionFilters(t);
		const from = Date.UTC(2026, 0, 1);
		const to = Date.UTC(2026, 0, 31, 23, 59, 59, 999);

		const call = await runSearch({
			query: 'invoice',
			filters: { timestamp: { from, to } },
		});

		assert.match(String(call.params.filter), new RegExp(`timestamp >= ${from}`));
		assert.match(String(call.params.filter), new RegExp(`timestamp <= ${to}`));
	});

	it('marks invalid date ranges invalid in the controller parser', () => {
		const controller = Object.create(SearchController.prototype) as any;
		const dateRange = controller.getDateRange('2026-02-01', '2026-01-01');

		assert.equal(dateRange.invalid, true);
		assert.equal(dateRange.range, null);
	});

	it('rejects unknown filter keys', async (t) => {
		stubPermissionFilters(t);
		const calls: SearchCall[] = [];
		const service = createService(calls);

		await assert.rejects(
			() =>
				service.searchEmails(
					{
						query: 'invoice',
						filters: { from: 'sender@example.com', arbitrary: 'nope' },
					},
					'user-1',
					'127.0.0.1'
				),
			SearchValidationError
		);
		assert.equal(calls.length, 0);
	});

	it('rejects multiple text search parameters', async (t) => {
		stubPermissionFilters(t);
		const calls: SearchCall[] = [];
		const service = createService(calls);

		await assert.rejects(
			() =>
				service.searchEmails(
					{
						query: '',
						fieldQueries: [
							{ attribute: 'subject', query: 'invoice' },
							{ attribute: 'body', query: 'invoice' },
						],
					},
					'user-1',
					'127.0.0.1'
				),
			/Provide only one text search parameter/
		);
		assert.equal(calls.length, 0);
	});
});
