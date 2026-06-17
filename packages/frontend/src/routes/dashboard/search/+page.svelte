<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import type { MatchingStrategy } from '@open-archiver/types';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { t } from '$lib/translations';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';

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

	let isMounted = $state(false);
	onMount(() => {
		isMounted = true;
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

		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[180px]">Date</Table.Head>
						<Table.Head class="min-w-[320px]">{$t('app.search.subject')}</Table.Head>
						<Table.Head class="w-[220px]">{$t('app.search.from')}</Table.Head>
						<Table.Head class="w-[260px]">{$t('app.search.to')}</Table.Head>
						<Table.Head class="w-[220px]">Mailbox</Table.Head>
						<Table.Head class="w-[110px]">Attachments</Table.Head>
						<Table.Head class="w-[90px] text-right">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if searchResult.hits.length > 0}
						{#each searchResult.hits as hit (hit.id)}
							{@const _formatted = hit._formatted || {}}
							{@const firstMatch = getFirstMatch(hit)}
							<Table.Row>
								<Table.Cell class="text-muted-foreground text-xs">
									{#if !isMounted}
										<Skeleton class="h-4 w-32" />
									{:else}
										{formatDate(hit.timestamp)}
									{/if}
								</Table.Cell>
								<Table.Cell class="max-w-[520px]">
									{#if !isMounted}
										<Skeleton class="h-5 w-3/4" />
									{:else}
										<a
											class="text-foreground block truncate font-medium hover:underline"
											href="/dashboard/archived-emails/{hit.id}"
											aria-label={`Open email: ${hit.subject || 'No subject'}`}
										>
											<span use:shadowRender={_formatted.subject || hit.subject}></span>
										</a>
										{#if firstMatch}
											<div class="mt-1 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 text-xs">
												<span class="text-muted-foreground">{firstMatch.label}:</span>
												<span
													class="min-w-0 font-mono text-muted-foreground"
													use:shadowRender={firstMatch.snippet}
												></span>
											</div>
										{/if}
									{/if}
								</Table.Cell>
								<Table.Cell class="max-w-[220px] text-sm">
									{#if !isMounted}
										<Skeleton class="h-4 w-36" />
									{:else}
										<span use:shadowRender={_formatted.from || hit.from}></span>
									{/if}
								</Table.Cell>
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
								<Table.Cell class="max-w-[220px] truncate text-sm">
									{hit.userEmail || '-'}
								</Table.Cell>
								<Table.Cell class="text-muted-foreground text-sm">
									{hit.attachments?.length || 0}
								</Table.Cell>
								<Table.Cell class="text-right">
									<a href="/dashboard/archived-emails/{hit.id}">
										<Button variant="outline" size="sm">Open</Button>
									</a>
								</Table.Cell>
							</Table.Row>
						{/each}
					{:else}
						<Table.Row>
							<Table.Cell colspan={7} class="text-center">
								{$t('app.search.found_results', { total: 0 } as any)}
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
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
