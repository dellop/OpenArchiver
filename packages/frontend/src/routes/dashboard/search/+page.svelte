<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { api } from '$lib/api.client';
	import EmailPreview from '$lib/components/custom/EmailPreview.svelte';
	import type {
		ArchivedEmail,
		MatchingStrategy,
		SearchSortBy,
		SearchSortDirection,
	} from '@open-archiver/types';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { t } from '$lib/translations';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';
	import ArrowUpDown from 'lucide-svelte/icons/arrow-up-down';
	import ArrowUp from 'lucide-svelte/icons/arrow-up';
	import ArrowDown from 'lucide-svelte/icons/arrow-down';
	import Columns3 from 'lucide-svelte/icons/columns-3';
	import X from 'lucide-svelte/icons/x';
	import { browser } from '$app/environment';

	let { data }: { data: PageData } = $props();
	let searchResult = $derived(data.searchResult);
	let keywords = $state(data.searchParams?.keywords || '');
	let from = $state(data.searchParams?.from || '');
	let to = $state(data.searchParams?.to || '');
	let cc = $state(data.searchParams?.cc || '');
	let bcc = $state(data.searchParams?.bcc || '');
	let subject = $state(data.searchParams?.subject || '');
	let body = $state(data.searchParams?.body || '');
	let attachmentFilename = $state(data.searchParams?.attachmentFilename || '');
	let attachmentContent = $state(data.searchParams?.attachmentContent || '');
	let dateFrom = $state(data.searchParams?.dateFrom || '');
	let dateTo = $state(data.searchParams?.dateTo || '');
	let page = $derived(data.page);
	let limit = $state(data.limit?.toString() || data.searchParams?.limit || '25');
	let sortBy: SearchSortBy = $state((data.sortBy as SearchSortBy) || 'timestamp');
	let sortDirection: SearchSortDirection = $state(
		(data.sortDirection as SearchSortDirection) || 'desc'
	);
	let error = $derived(data.error);
	let matchingStrategy: MatchingStrategy = $state(
		(data.matchingStrategy as MatchingStrategy) || 'last'
	);
	const hasInitialAdvancedFilters = Boolean(
		data.searchParams?.from ||
			data.searchParams?.to ||
			data.searchParams?.cc ||
			data.searchParams?.bcc ||
			data.searchParams?.subject ||
			data.searchParams?.body ||
			data.searchParams?.attachmentFilename ||
			data.searchParams?.attachmentContent ||
			data.searchParams?.dateFrom ||
			data.searchParams?.dateTo
	);
	let advancedOpen = $state(hasInitialAdvancedFilters);

	const strategies = [
		{ value: 'last', label: $t('app.search.strategy_fuzzy') },
		{ value: 'all', label: $t('app.search.strategy_verbatim') },
		{ value: 'frequency', label: $t('app.search.strategy_frequency') },
	];

	const triggerContent = $derived(
		strategies.find((s) => s.value === matchingStrategy)?.label ??
			$t('app.search.select_strategy')
	);
	const MAX_PAGE_SIZE = 500;
	type ColumnId = 'date' | 'subject' | 'from' | 'to' | 'mailbox' | 'attachments';
	const DEFAULT_COLUMNS: ColumnId[] = ['date', 'subject', 'from', 'to', 'attachments'];
	const COLUMN_STORAGE_KEY = 'open-archiver.search.visible-columns';
	const columnOptions: {
		id: ColumnId;
		label: string;
		sortBy?: SearchSortBy;
		required?: boolean;
	}[] = [
		{ id: 'date', label: 'Date', sortBy: 'timestamp' },
		{ id: 'subject', label: $t('app.search.subject'), sortBy: 'subject', required: true },
		{ id: 'from', label: $t('app.search.from'), sortBy: 'from' },
		{ id: 'to', label: $t('app.search.to'), sortBy: 'toSort' },
		{ id: 'mailbox', label: 'Mailbox', sortBy: 'userEmail' },
		{ id: 'attachments', label: 'Attachments', sortBy: 'attachmentCount' },
	];
	let visibleColumns = $state<ColumnId[]>(DEFAULT_COLUMNS);
	let previewEmail = $state<ArchivedEmail | null>(null);
	let previewEmailId = $state('');
	let previewLoading = $state(false);
	let previewError = $state('');

	let isMounted = $state(false);
	onMount(() => {
		isMounted = true;
		const storedColumns = localStorage.getItem(COLUMN_STORAGE_KEY);
		if (storedColumns) {
			try {
				const parsed = JSON.parse(storedColumns) as ColumnId[];
				const validColumns = parsed.filter((column): column is ColumnId =>
					columnOptions.some((option) => option.id === column)
				);
				if (validColumns.includes('subject')) {
					visibleColumns = validColumns;
				}
			} catch {
				visibleColumns = DEFAULT_COLUMNS;
			}
		}
	});

	$effect(() => {
		if (browser && visibleColumns.length > 0) {
			localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
		}
	});

	function shadowRender(node: HTMLElement, html: string | undefined) {
		if (html === undefined) return;

		const shadow = node.attachShadow({ mode: 'open' });
		const style = document.createElement('style');
		style.textContent = `
			:host { display: block; min-width: 0; }
			div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
			em { background-color: #fde047; font-style: normal; color: #1f2937; }
		`; // yellow-300, gray-800
		shadow.appendChild(style);
		const content = document.createElement('div');
		content.innerHTML = html;
		shadow.appendChild(content);

		return {
			update(newHtml: string | undefined) {
				if (newHtml === undefined) return;
				content.innerHTML = newHtml;
			},
		};
	}

	function handleSearch(e: SubmitEvent) {
		e.preventDefault();
		const params = buildSearchParams();
		params.set('page', '1');
		goto(`/dashboard/search?${params.toString()}`, { keepFocus: true });
	}

	function setParam(params: URLSearchParams, key: string, value: string) {
		const trimmed = value.trim();
		if (trimmed) {
			params.set(key, trimmed);
		}
	}

	function buildSearchParams() {
		const params = new URLSearchParams();
		setParam(params, 'keywords', keywords);
		setParam(params, 'from', from);
		setParam(params, 'to', to);
		setParam(params, 'cc', cc);
		setParam(params, 'bcc', bcc);
		setParam(params, 'subject', subject);
		setParam(params, 'body', body);
		setParam(params, 'attachmentFilename', attachmentFilename);
		setParam(params, 'attachmentContent', attachmentContent);
		setParam(params, 'dateFrom', dateFrom);
		setParam(params, 'dateTo', dateTo);
		params.set('matchingStrategy', matchingStrategy);
		params.set('limit', clampLimit(limit).toString());
		params.set('sortBy', sortBy);
		params.set('sortDirection', sortDirection);
		return params;
	}

	function clampLimit(value: string | number) {
		const parsed = typeof value === 'number' ? value : parseInt(value, 10);
		if (!Number.isInteger(parsed) || parsed < 1) return 25;
		return Math.min(parsed, MAX_PAGE_SIZE);
	}

	function applyPageSize() {
		limit = clampLimit(limit).toString();
		const params = buildSearchParams();
		params.set('page', '1');
		goto(`/dashboard/search?${params.toString()}`, { keepFocus: true });
	}

	function pageHref(nextPage: number) {
		const params = buildSearchParams();
		params.set('page', nextPage.toString());
		return `/dashboard/search?${params.toString()}`;
	}

	function sortHref(columnSortBy: SearchSortBy) {
		const params = buildSearchParams();
		const nextDirection =
			sortBy === columnSortBy ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
		const defaultDirection = columnSortBy === 'timestamp' ? 'desc' : nextDirection;
		params.set('sortBy', columnSortBy);
		params.set('sortDirection', sortBy === columnSortBy ? nextDirection : defaultDirection);
		params.set('page', '1');
		return `/dashboard/search?${params.toString()}`;
	}

	function clearAdvancedFilters() {
		from = '';
		to = '';
		cc = '';
		bcc = '';
		subject = '';
		body = '';
		attachmentFilename = '';
		attachmentContent = '';
		dateFrom = '';
		dateTo = '';
	}

	const activeFilters = $derived(
		[
			{ label: $t('app.search.keywords'), value: keywords },
			{ label: $t('app.search.from'), value: from },
			{ label: $t('app.search.to'), value: to },
			{ label: $t('app.search.cc'), value: cc },
			{ label: $t('app.search.bcc'), value: bcc },
			{ label: $t('app.search.subject'), value: subject },
			{ label: $t('app.search.body'), value: body },
			{ label: $t('app.search.attachment_filename'), value: attachmentFilename },
			{ label: $t('app.search.attachment_content'), value: attachmentContent },
			{ label: $t('app.search.date_from'), value: dateFrom },
			{ label: $t('app.search.date_to'), value: dateTo },
			{ label: $t('app.search.matching_strategy'), value: triggerContent },
		].filter((filter) => filter.value)
	);

	function getHighlightedSnippets(text: string | undefined, snippetLength = 80): string[] {
		if (!text || !text.includes('<em>')) {
			return [];
		}

		const snippets: string[] = [];
		const regex = /<em>.*?<\/em>/g;
		let match;
		let lastIndex = 0;

		while ((match = regex.exec(text)) !== null) {
			if (match.index < lastIndex) {
				continue;
			}

			const matchIndex = match.index;
			const matchLength = match[0].length;

			const start = Math.max(0, matchIndex - snippetLength);
			const end = Math.min(text.length, matchIndex + matchLength + snippetLength);

			lastIndex = end;

			let snippet = text.substring(start, end);

			// Then, balance them
			const openCount = (snippet.match(/<em/g) || []).length;
			const closeCount = (snippet.match(/<\/em>/g) || []).length;

			if (openCount > closeCount) {
				snippet += '</em>';
			}

			if (closeCount > openCount) {
				snippet = '<em>' + snippet;
			}

			// Finally, add ellipsis
			if (start > 0) {
				snippet = '...' + snippet;
			}
			if (end < text.length) {
				snippet += '...';
			}

			snippets.push(snippet);
		}

		return snippets;
	}

	function getFirstMatch(hit: NonNullable<typeof searchResult>['hits'][number]) {
		const formatted = hit._formatted || {};
		const bodySnippet = getHighlightedSnippets(formatted.body, 70)[0];
		if (bodySnippet) {
			return {
				label: $t('app.search.in_email_body'),
				snippet: bodySnippet,
			};
		}

		for (const attachment of formatted.attachments || []) {
			const snippet = getHighlightedSnippets(attachment?.content, 70)[0];
			if (snippet) {
				return {
					label: $t('app.search.in_attachment', {
						filename: attachment.filename || $t('app.search.attachment_filename'),
					} as any),
					snippet,
				};
			}
		}

		return null;
	}

	function formatRecipients(recipients: string[] | undefined) {
		return recipients?.filter(Boolean).join(', ') || '-';
	}

	function formatDate(timestamp: number) {
		return new Date(timestamp).toLocaleString();
	}

	function isColumnVisible(column: ColumnId) {
		return visibleColumns.includes(column);
	}

	function toggleColumn(column: ColumnId) {
		const option = columnOptions.find((candidate) => candidate.id === column);
		if (option?.required) return;

		if (visibleColumns.includes(column)) {
			visibleColumns = visibleColumns.filter((visibleColumn) => visibleColumn !== column);
		} else {
			const orderedColumns = [...visibleColumns, column];
			visibleColumns = columnOptions
				.map((candidate) => candidate.id)
				.filter((candidate) => orderedColumns.includes(candidate));
		}
	}

	function getColumnCount() {
		return visibleColumns.length + 1;
	}

	async function selectPreview(id: string) {
		if (previewEmailId === id && previewEmail) return;

		previewEmailId = id;
		previewEmail = null;
		previewError = '';
		previewLoading = true;

		try {
			const response = await api(`/archived-emails/${id}`);
			if (!response.ok) {
				const errorBody = await response.json().catch(() => null);
				throw new Error(errorBody?.message || 'Failed to load email preview.');
			}
			previewEmail = (await response.json()) as ArchivedEmail;
		} catch (error) {
			previewError = error instanceof Error ? error.message : 'Failed to load email preview.';
		} finally {
			previewLoading = false;
		}
	}

	function closePreview() {
		previewEmailId = '';
		previewEmail = null;
		previewError = '';
		previewLoading = false;
	}
</script>

<svelte:head>
	<title>{$t('app.search.title')} | Open Archiver</title>
	<meta name="description" content={$t('app.search.description')} />
</svelte:head>

<div class="container mx-auto p-4 md:p-8">
	<h1 class="mb-4 text-2xl font-bold">{$t('app.search.email_search')}</h1>

	<form onsubmit={(e) => handleSearch(e)} class="mb-8 flex flex-col space-y-2">
		<div class="flex items-center gap-2">
			<Input
				type="search"
				name="keywords"
				placeholder={$t('app.search.placeholder')}
				class=" h-12 flex-grow"
				bind:value={keywords}
			/>
			<Button type="submit" class="h-12 cursor-pointer"
				>{$t('app.search.search_button')}</Button
			>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Select.Root type="single" name="matchingStrategy" bind:value={matchingStrategy}>
				<Select.Trigger class=" w-[180px] cursor-pointer">
					{triggerContent}
				</Select.Trigger>
				<Select.Content>
					{#each strategies as strategy (strategy.value)}
						<Select.Item
							value={strategy.value}
							label={strategy.label}
							class="cursor-pointer"
						>
							{strategy.label}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Button
				type="button"
				variant="outline"
				class="h-9"
				onclick={() => (advancedOpen = !advancedOpen)}
				aria-expanded={advancedOpen}
			>
				<SlidersHorizontal class="h-4 w-4" />
				{$t('app.search.advanced_search')}
			</Button>
		</div>
		{#if advancedOpen}
			<div class="grid gap-3 rounded-md border p-4 md:grid-cols-2 xl:grid-cols-4">
				<div class="space-y-1">
					<label for="from" class="text-sm font-medium">{$t('app.search.from')}</label>
					<Input
						id="from"
						name="from"
						bind:value={from}
						placeholder="sender@example.com"
					/>
				</div>
				<div class="space-y-1">
					<label for="to" class="text-sm font-medium">{$t('app.search.to')}</label>
					<Input id="to" name="to" bind:value={to} placeholder="recipient@example.com" />
				</div>
				<div class="space-y-1">
					<label for="cc" class="text-sm font-medium">{$t('app.search.cc')}</label>
					<Input id="cc" name="cc" bind:value={cc} placeholder="copy@example.com" />
				</div>
				<div class="space-y-1">
					<label for="bcc" class="text-sm font-medium">{$t('app.search.bcc')}</label>
					<Input id="bcc" name="bcc" bind:value={bcc} placeholder="hidden@example.com" />
				</div>
				<div class="space-y-1">
					<label for="subject" class="text-sm font-medium"
						>{$t('app.search.subject')}</label
					>
					<Input id="subject" name="subject" bind:value={subject} />
				</div>
				<div class="space-y-1">
					<label for="body" class="text-sm font-medium">{$t('app.search.body')}</label>
					<Input id="body" name="body" bind:value={body} />
				</div>
				<div class="space-y-1">
					<label for="attachmentFilename" class="text-sm font-medium"
						>{$t('app.search.attachment_filename')}</label
					>
					<Input
						id="attachmentFilename"
						name="attachmentFilename"
						bind:value={attachmentFilename}
					/>
				</div>
				<div class="space-y-1">
					<label for="attachmentContent" class="text-sm font-medium"
						>{$t('app.search.attachment_content')}</label
					>
					<Input
						id="attachmentContent"
						name="attachmentContent"
						bind:value={attachmentContent}
					/>
				</div>
				<div class="space-y-1">
					<label for="dateFrom" class="text-sm font-medium"
						>{$t('app.search.date_from')}</label
					>
					<Input id="dateFrom" type="date" name="dateFrom" bind:value={dateFrom} />
				</div>
				<div class="space-y-1">
					<label for="dateTo" class="text-sm font-medium"
						>{$t('app.search.date_to')}</label
					>
					<Input id="dateTo" type="date" name="dateTo" bind:value={dateTo} />
				</div>
				<div class="flex items-end">
					<Button type="button" variant="ghost" onclick={clearAdvancedFilters}>
						{$t('app.search.clear_filters')}
					</Button>
				</div>
			</div>
		{/if}
	</form>

	{#if error}
		<Alert.Root variant="destructive">
			<CircleAlertIcon class="size-4" />
			<Alert.Title>{$t('app.search.error')}</Alert.Title>
			<Alert.Description>{error}</Alert.Description>
		</Alert.Root>
	{/if}

	{#if searchResult}
		{#if activeFilters.length > 0}
			<div class="mb-4 flex flex-wrap gap-2">
				{#each activeFilters as filter}
					<Badge variant="secondary">{filter.label}: {filter.value}</Badge>
				{/each}
			</div>
		{/if}

		<div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<p class="text-muted-foreground text-sm">
				{#if searchResult.total > 0}
					{$t('app.search.found_results_in', {
						total: searchResult.total,
						seconds: searchResult.processingTimeMs / 1000,
					} as any)}
				{:else}
					{$t('app.search.found_results', { total: searchResult.total } as any)}
				{/if}
			</p>
			<div class="flex items-center gap-2">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button type="button" variant="outline" class="h-9">
							<Columns3 class="h-4 w-4" />
							Columns
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-48">
						<DropdownMenu.Label>Show columns</DropdownMenu.Label>
						<DropdownMenu.Separator />
						{#each columnOptions as column (column.id)}
							<DropdownMenu.CheckboxItem
								checked={isColumnVisible(column.id)}
								disabled={column.required}
								onclick={() => toggleColumn(column.id)}
							>
								{column.label}
							</DropdownMenu.CheckboxItem>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
				<label for="search-page-size" class="text-muted-foreground text-sm">
					Rows
				</label>
				<Input
					id="search-page-size"
					type="number"
					min="1"
					max={MAX_PAGE_SIZE}
					class="h-9 w-24"
					bind:value={limit}
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							applyPageSize();
						}
					}}
				/>
				<Button type="button" variant="outline" class="h-9" onclick={applyPageSize}>
					Apply
				</Button>
			</div>
		</div>

		<div class:grid={Boolean(previewEmailId)} class:gap-4={Boolean(previewEmailId)} class="xl:grid-cols-[minmax(0,1fr)_minmax(360px,42vw)]">
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							{#if isColumnVisible('date')}
								<Table.Head class="w-[180px]">
									<a
										href={sortHref('timestamp')}
										class="inline-flex items-center gap-1 hover:underline"
									>
										Date
										{#if sortBy === 'timestamp'}
											{#if sortDirection === 'asc'}
												<ArrowUp class="h-3.5 w-3.5" />
											{:else}
												<ArrowDown class="h-3.5 w-3.5" />
											{/if}
										{:else}
											<ArrowUpDown class="h-3.5 w-3.5" />
										{/if}
									</a>
								</Table.Head>
							{/if}
							<Table.Head class="min-w-[320px]">
								<a
									href={sortHref('subject')}
									class="inline-flex items-center gap-1 hover:underline"
								>
									{$t('app.search.subject')}
									{#if sortBy === 'subject'}
										{#if sortDirection === 'asc'}
											<ArrowUp class="h-3.5 w-3.5" />
										{:else}
											<ArrowDown class="h-3.5 w-3.5" />
										{/if}
									{:else}
										<ArrowUpDown class="h-3.5 w-3.5" />
									{/if}
								</a>
							</Table.Head>
							{#if isColumnVisible('from')}
								<Table.Head class="w-[220px]">
									<a
										href={sortHref('from')}
										class="inline-flex items-center gap-1 hover:underline"
									>
										{$t('app.search.from')}
										{#if sortBy === 'from'}
											{#if sortDirection === 'asc'}
												<ArrowUp class="h-3.5 w-3.5" />
											{:else}
												<ArrowDown class="h-3.5 w-3.5" />
											{/if}
										{:else}
											<ArrowUpDown class="h-3.5 w-3.5" />
										{/if}
									</a>
								</Table.Head>
							{/if}
							{#if isColumnVisible('to')}
								<Table.Head class="w-[260px]">
									<a
										href={sortHref('toSort')}
										class="inline-flex items-center gap-1 hover:underline"
									>
										{$t('app.search.to')}
										{#if sortBy === 'toSort'}
											{#if sortDirection === 'asc'}
												<ArrowUp class="h-3.5 w-3.5" />
											{:else}
												<ArrowDown class="h-3.5 w-3.5" />
											{/if}
										{:else}
											<ArrowUpDown class="h-3.5 w-3.5" />
										{/if}
									</a>
								</Table.Head>
							{/if}
							{#if isColumnVisible('mailbox')}
								<Table.Head class="w-[220px]">
									<a
										href={sortHref('userEmail')}
										class="inline-flex items-center gap-1 hover:underline"
									>
										Mailbox
										{#if sortBy === 'userEmail'}
											{#if sortDirection === 'asc'}
												<ArrowUp class="h-3.5 w-3.5" />
											{:else}
												<ArrowDown class="h-3.5 w-3.5" />
											{/if}
										{:else}
											<ArrowUpDown class="h-3.5 w-3.5" />
										{/if}
									</a>
								</Table.Head>
							{/if}
							{#if isColumnVisible('attachments')}
								<Table.Head class="w-[110px]">
									<a
										href={sortHref('attachmentCount')}
										class="inline-flex items-center gap-1 hover:underline"
									>
										Attachments
										{#if sortBy === 'attachmentCount'}
											{#if sortDirection === 'asc'}
												<ArrowUp class="h-3.5 w-3.5" />
											{:else}
												<ArrowDown class="h-3.5 w-3.5" />
											{/if}
										{:else}
											<ArrowUpDown class="h-3.5 w-3.5" />
										{/if}
									</a>
								</Table.Head>
							{/if}
							<Table.Head class="w-[150px] text-right">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if searchResult.hits.length > 0}
							{#each searchResult.hits as hit (hit.id)}
								{@const _formatted = hit._formatted || {}}
								{@const firstMatch = getFirstMatch(hit)}
								<Table.Row
									class={previewEmailId === hit.id ? 'bg-muted/70' : ''}
									onclick={() => selectPreview(hit.id)}
								>
									{#if isColumnVisible('date')}
										<Table.Cell class="text-muted-foreground text-xs">
											{#if !isMounted}
												<Skeleton class="h-4 w-32" />
											{:else}
												{formatDate(hit.timestamp)}
											{/if}
										</Table.Cell>
									{/if}
									<Table.Cell class="max-w-[520px]">
										{#if !isMounted}
											<Skeleton class="h-5 w-3/4" />
										{:else}
											<button
												type="button"
												class="text-foreground block max-w-full truncate text-left font-medium hover:underline"
												aria-label={`Preview email: ${hit.subject || 'No subject'}`}
												onclick={(event) => {
													event.stopPropagation();
													selectPreview(hit.id);
												}}
											>
												<span use:shadowRender={_formatted.subject || hit.subject}></span>
											</button>
											{#if firstMatch}
												<div class="mt-1 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 text-xs">
													<span class="text-muted-foreground">{firstMatch.label}:</span>
													<span
														class="text-muted-foreground min-w-0 font-mono"
														use:shadowRender={firstMatch.snippet}
													></span>
												</div>
											{/if}
										{/if}
									</Table.Cell>
									{#if isColumnVisible('from')}
										<Table.Cell class="max-w-[220px] text-sm">
											{#if !isMounted}
												<Skeleton class="h-4 w-36" />
											{:else}
												<span use:shadowRender={_formatted.from || hit.from}></span>
											{/if}
										</Table.Cell>
									{/if}
									{#if isColumnVisible('to')}
										<Table.Cell class="max-w-[260px] text-sm">
											{#if !isMounted}
												<Skeleton class="h-4 w-40" />
											{:else}
												<span
													use:shadowRender={_formatted.to?.join(', ') ||
														formatRecipients(hit.to)}
												></span>
											{/if}
										</Table.Cell>
									{/if}
									{#if isColumnVisible('mailbox')}
										<Table.Cell class="max-w-[220px] truncate text-sm">
											{hit.userEmail || '-'}
										</Table.Cell>
									{/if}
									{#if isColumnVisible('attachments')}
										<Table.Cell class="text-muted-foreground text-sm">
											{hit.attachments?.length || 0}
										</Table.Cell>
									{/if}
									<Table.Cell class="text-right">
										<a
											href="/dashboard/archived-emails/{hit.id}"
											onclick={(event) => event.stopPropagation()}
										>
											<Button variant="outline" size="sm">Open</Button>
										</a>
									</Table.Cell>
								</Table.Row>
							{/each}
						{:else}
							<Table.Row>
								<Table.Cell colspan={getColumnCount()} class="text-center">
									{$t('app.search.found_results', { total: 0 } as any)}
								</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>
			</div>

			{#if previewEmailId}
				<aside class="mt-4 rounded-md border xl:sticky xl:top-4 xl:mt-0 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
					<div class="flex items-start justify-between gap-3 border-b p-3">
						<div class="min-w-0">
							<p class="text-sm font-medium">Preview</p>
							<p class="text-muted-foreground truncate text-xs">
								{previewEmail?.subject || 'Loading email...'}
							</p>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							class="h-8 w-8"
							aria-label="Close preview"
							onclick={closePreview}
						>
							<X class="h-4 w-4" />
						</Button>
					</div>
					<div class="space-y-3 p-3">
						{#if previewLoading}
							<Skeleton class="h-5 w-3/4" />
							<Skeleton class="h-4 w-1/2" />
							<Skeleton class="h-[420px] w-full" />
						{:else if previewError}
							<Alert.Root variant="destructive">
								<CircleAlertIcon class="size-4" />
								<Alert.Title>{$t('app.search.error')}</Alert.Title>
								<Alert.Description>{previewError}</Alert.Description>
							</Alert.Root>
						{:else if previewEmail}
							<div class="space-y-1">
								<h2 class="truncate text-base font-semibold">
									{previewEmail.subject || $t('app.archive.no_subject')}
								</h2>
								<p class="text-muted-foreground text-xs">
									{$t('app.archive.from')}: {previewEmail.senderEmail ||
										previewEmail.senderName}
								</p>
								<p class="text-muted-foreground text-xs">
									{$t('app.archive.sent')}: {new Date(
										previewEmail.sentAt
									).toLocaleString()}
								</p>
								<p class="text-muted-foreground truncate text-xs">
									{$t('app.archive.to')}: {previewEmail.recipients
										.map((recipient) => recipient.email || recipient.name)
										.join(', ')}
								</p>
							</div>
							<EmailPreview raw={previewEmail.raw} />
						{/if}
					</div>
				</aside>
			{/if}
		</div>

		{#if searchResult.total > searchResult.limit}
			<div class="mt-8">
				<Pagination.Root count={searchResult.total} perPage={searchResult.limit} {page}>
					{#snippet children({ pages, currentPage })}
						<Pagination.Content>
							<Pagination.Item>
								<a href={pageHref(currentPage - 1)}>
									<Pagination.PrevButton>
										<ChevronLeft class="h-4 w-4" />
										<span class="hidden sm:block">{$t('app.search.prev')}</span>
									</Pagination.PrevButton>
								</a>
							</Pagination.Item>
							{#each pages as page (page.key)}
								{#if page.type === 'ellipsis'}
									<Pagination.Item>
										<Pagination.Ellipsis />
									</Pagination.Item>
								{:else}
									<Pagination.Item>
										<a href={pageHref(page.value)}>
											<Pagination.Link
												{page}
												isActive={currentPage === page.value}
											>
												{page.value}
											</Pagination.Link>
										</a>
									</Pagination.Item>
								{/if}
							{/each}
							<Pagination.Item>
								<a href={pageHref(currentPage + 1)}>
									<Pagination.NextButton>
										<span class="hidden sm:block">{$t('app.search.next')}</span>
										<ChevronRight class="h-4 w-4" />
									</Pagination.NextButton>
								</a>
							</Pagination.Item>
						</Pagination.Content>
					{/snippet}
				</Pagination.Root>
			</div>
		{/if}
	{/if}
</div>
