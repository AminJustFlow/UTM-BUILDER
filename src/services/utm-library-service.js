const DEFAULT_STATUSES = ["completed", "completed_without_short_link"];
const DEFAULT_SORT = "recent";
const SORT_OPTIONS = ["recent", "oldest", "client", "campaign", "requests"];
const TOGGLE_FILTERS = ["all", "with_qr", "without_qr", "with_short_link", "without_short_link"];

export class UtmLibraryService {
  constructor(requestRepository, { cache = null, logger = null, cacheTtlMs = 5 * 60 * 1000 } = {}) {
    this.requestRepository = requestRepository;
    this.cache = cache;
    this.logger = logger;
    this.cacheTtlMs = Math.max(30 * 1000, Number(cacheTtlMs) || (5 * 60 * 1000));
    this.inflight = new Map();
  }

  list(query = {}) {
    const normalizedQuery = normalizeLibraryQuery(query);
    const page = normalizedQuery.page;
    const perPage = normalizedQuery.perPage;
    const statusFilter = normalizedQuery.status;
    const statuses = resolveStatuses(statusFilter);
    const offset = (page - 1) * perPage;
    const library = this.requestRepository.listTrackedRequestLibrary({
      statuses,
      client: normalizedQuery.client,
      channel: normalizedQuery.channel,
      source: normalizedQuery.source,
      medium: normalizedQuery.medium,
      term: normalizedQuery.term,
      content: normalizedQuery.content,
      campaign: normalizedQuery.campaign,
      status: statusFilter || "all",
      search: normalizedQuery.search,
      qr: normalizedQuery.qr,
      shortLink: normalizedQuery.shortLink,
      sort: normalizedQuery.sort,
      limit: perPage,
      offset
    });
    const items = (library.rows ?? []).map((row) => this.mapRow(row));
    const available = this.buildFacetAvailability(normalizedQuery);
    const total = Number(library.summary?.filtered_links ?? 0);
    const totalRequests = Number(library.summary?.requests_represented ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(page, pageCount);
    const totalWithQr = Number(library.summary?.with_qr ?? 0);
    const totalWithoutShortLink = Number(library.summary?.without_short_link ?? 0);

    return {
      items,
      available,
      filters: {
        client: normalizedQuery.client,
        channel: normalizedQuery.channel,
        source: normalizedQuery.source,
        medium: normalizedQuery.medium,
        term: normalizedQuery.term,
        content: normalizedQuery.content,
        campaign: normalizedQuery.campaign,
        status: statusFilter || "all",
        search: normalizedQuery.search,
        qr: normalizedQuery.qr,
        shortLink: normalizedQuery.shortLink,
        sort: normalizedQuery.sort,
        perPage
      },
      pagination: {
        page: currentPage,
        perPage,
        total,
        pageCount,
        hasPreviousPage: currentPage > 1,
        hasNextPage: currentPage < pageCount
      },
      summary: {
        totalUniqueLinks: Number(library.summary?.total_unique_links ?? 0),
        filteredLinks: total,
        requestsRepresented: totalRequests,
        withQr: totalWithQr,
        withoutShortLink: totalWithoutShortLink
      }
    };
  }

  async listAsync(query = {}) {
    const normalizedQuery = normalizeLibraryQuery(query);
    const page = normalizedQuery.page;
    const perPage = normalizedQuery.perPage;
    const statusFilter = normalizedQuery.status;
    const statuses = resolveStatuses(statusFilter);
    const offset = (page - 1) * perPage;
    const library = await (this.requestRepository.listTrackedRequestLibraryAsync?.({
      statuses,
      client: normalizedQuery.client,
      channel: normalizedQuery.channel,
      source: normalizedQuery.source,
      medium: normalizedQuery.medium,
      term: normalizedQuery.term,
      content: normalizedQuery.content,
      campaign: normalizedQuery.campaign,
      status: statusFilter || "all",
      search: normalizedQuery.search,
      qr: normalizedQuery.qr,
      shortLink: normalizedQuery.shortLink,
      sort: normalizedQuery.sort,
      limit: perPage,
      offset
    }) ?? this.requestRepository.listTrackedRequestLibrary({
      statuses,
      client: normalizedQuery.client,
      channel: normalizedQuery.channel,
      source: normalizedQuery.source,
      medium: normalizedQuery.medium,
      term: normalizedQuery.term,
      content: normalizedQuery.content,
      campaign: normalizedQuery.campaign,
      status: statusFilter || "all",
      search: normalizedQuery.search,
      qr: normalizedQuery.qr,
      shortLink: normalizedQuery.shortLink,
      sort: normalizedQuery.sort,
      limit: perPage,
      offset
    }));
    const items = (library.rows ?? []).map((row) => this.mapRow(row));
    const available = await this.buildFacetAvailabilityAsync(normalizedQuery);
    const total = Number(library.summary?.filtered_links ?? 0);
    const totalRequests = Number(library.summary?.requests_represented ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(page, pageCount);
    const totalWithQr = Number(library.summary?.with_qr ?? 0);
    const totalWithoutShortLink = Number(library.summary?.without_short_link ?? 0);

    return {
      items,
      available,
      filters: {
        client: normalizedQuery.client,
        channel: normalizedQuery.channel,
        source: normalizedQuery.source,
        medium: normalizedQuery.medium,
        term: normalizedQuery.term,
        content: normalizedQuery.content,
        campaign: normalizedQuery.campaign,
        status: statusFilter || "all",
        search: normalizedQuery.search,
        qr: normalizedQuery.qr,
        shortLink: normalizedQuery.shortLink,
        sort: normalizedQuery.sort,
        perPage
      },
      pagination: {
        page: currentPage,
        perPage,
        total,
        pageCount,
        hasPreviousPage: currentPage > 1,
        hasNextPage: currentPage < pageCount
      },
      summary: {
        totalUniqueLinks: Number(library.summary?.total_unique_links ?? 0),
        filteredLinks: total,
        requestsRepresented: totalRequests,
        withQr: totalWithQr,
        withoutShortLink: totalWithoutShortLink
      }
    };
  }

  getByRequestId(requestId) {
    const row = this.requestRepository.findById(requestId);
    return row ? this.mapRequestRecord(row) : null;
  }

  async getByRequestIdAsync(requestId) {
    const row = await (this.requestRepository.findByIdAsync?.(requestId)
      ?? this.requestRepository.findById(requestId));
    return row ? this.mapRequestRecord(row) : null;
  }

  listCached(query = {}) {
    if (!this.cache) {
      return this.list(query);
    }
    const cacheKey = this.buildCacheKey(query);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        pending: false,
        cache_status: "hit"
      };
    }
    this.queueRefresh(cacheKey, query);
    return buildPendingLibrary(query);
  }

  async listCachedAsync(query = {}) {
    if (!this.cache) {
      return this.listAsync(query);
    }
    const cacheKey = this.buildCacheKey(query);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        pending: false,
        cache_status: "hit"
      };
    }
    this.queueRefresh(cacheKey, query);
    return buildPendingLibrary(query);
  }

  buildCacheKey(query = {}) {
    const normalizedQuery = normalizeLibraryQuery(query);
    const normalized = {
      page: normalizedQuery.page,
      per_page: normalizedQuery.perPage,
      client: normalizedQuery.client,
      channel: normalizedQuery.channel,
      source: normalizedQuery.source,
      medium: normalizedQuery.medium,
      term: normalizedQuery.term,
      content: normalizedQuery.content,
      campaign: normalizedQuery.campaign,
      status: normalizedQuery.status,
      search: normalizedQuery.search,
      qr: normalizedQuery.qr,
      short_link: normalizedQuery.shortLink,
      sort: normalizedQuery.sort
    };
    return `utm_library:${JSON.stringify(normalized)}`;
  }

  buildFacetAvailability(normalizedQuery) {
    return {
      clients: uniqueValues(this.listFacetValues(normalizedQuery, "client", "clients")),
      channels: uniqueValues(this.listFacetValues(normalizedQuery, "channel", "channels")),
      sources: uniqueValues(this.listFacetValues(normalizedQuery, "source", "sources")),
      mediums: uniqueValues(this.listFacetValues(normalizedQuery, "medium", "mediums")),
      statuses: this.listToggleFacetValues(normalizedQuery, "status", DEFAULT_STATUSES),
      qrStates: this.listToggleFacetValues(normalizedQuery, "qr", ["with_qr", "without_qr"]),
      shortLinkStates: this.listToggleFacetValues(normalizedQuery, "shortLink", ["with_short_link", "without_short_link"]),
      sorts: SORT_OPTIONS
    };
  }

  async buildFacetAvailabilityAsync(normalizedQuery) {
    const [
      clients,
      channels,
      sources,
      mediums,
      statuses,
      qrStates,
      shortLinkStates
    ] = await Promise.all([
      this.listFacetValuesAsync(normalizedQuery, "client", "clients"),
      this.listFacetValuesAsync(normalizedQuery, "channel", "channels"),
      this.listFacetValuesAsync(normalizedQuery, "source", "sources"),
      this.listFacetValuesAsync(normalizedQuery, "medium", "mediums"),
      this.listToggleFacetValuesAsync(normalizedQuery, "status", DEFAULT_STATUSES),
      this.listToggleFacetValuesAsync(normalizedQuery, "qr", ["with_qr", "without_qr"]),
      this.listToggleFacetValuesAsync(normalizedQuery, "shortLink", ["with_short_link", "without_short_link"])
    ]);

    return {
      clients: uniqueValues(clients),
      channels: uniqueValues(channels),
      sources: uniqueValues(sources),
      mediums: uniqueValues(mediums),
      statuses,
      qrStates,
      shortLinkStates,
      sorts: SORT_OPTIONS
    };
  }

  listFacetValues(normalizedQuery, omittedField, resultKey) {
    const facetQuery = omitFacetField(normalizedQuery, omittedField);
    const library = this.requestRepository.listTrackedRequestLibrary({
      statuses: resolveStatuses(facetQuery.status),
      client: facetQuery.client,
      channel: facetQuery.channel,
      source: facetQuery.source,
      medium: facetQuery.medium,
      term: facetQuery.term,
      content: facetQuery.content,
      campaign: facetQuery.campaign,
      status: facetQuery.status || "all",
      search: facetQuery.search,
      qr: facetQuery.qr,
      shortLink: facetQuery.shortLink,
      sort: facetQuery.sort,
      limit: 1,
      offset: 0
    });
    return library.available?.[resultKey] ?? [];
  }

  async listFacetValuesAsync(normalizedQuery, omittedField, resultKey) {
    const facetQuery = omitFacetField(normalizedQuery, omittedField);
    const library = await (this.requestRepository.listTrackedRequestLibraryAsync?.({
      statuses: resolveStatuses(facetQuery.status),
      client: facetQuery.client,
      channel: facetQuery.channel,
      source: facetQuery.source,
      medium: facetQuery.medium,
      term: facetQuery.term,
      content: facetQuery.content,
      campaign: facetQuery.campaign,
      status: facetQuery.status || "all",
      search: facetQuery.search,
      qr: facetQuery.qr,
      shortLink: facetQuery.shortLink,
      sort: facetQuery.sort,
      limit: 1,
      offset: 0
    }) ?? this.requestRepository.listTrackedRequestLibrary({
      statuses: resolveStatuses(facetQuery.status),
      client: facetQuery.client,
      channel: facetQuery.channel,
      source: facetQuery.source,
      medium: facetQuery.medium,
      term: facetQuery.term,
      content: facetQuery.content,
      campaign: facetQuery.campaign,
      status: facetQuery.status || "all",
      search: facetQuery.search,
      qr: facetQuery.qr,
      shortLink: facetQuery.shortLink,
      sort: facetQuery.sort,
      limit: 1,
      offset: 0
    }));
    return library.available?.[resultKey] ?? [];
  }

  listToggleFacetValues(normalizedQuery, fieldName, values) {
    return ["all", ...values.filter((value) => this.hasFacetResults(normalizedQuery, fieldName, value))];
  }

  async listToggleFacetValuesAsync(normalizedQuery, fieldName, values) {
    const results = await Promise.all(values.map(async (value) => {
      return (await this.hasFacetResultsAsync(normalizedQuery, fieldName, value)) ? value : null;
    }));
    return ["all", ...results.filter(Boolean)];
  }

  hasFacetResults(normalizedQuery, fieldName, value) {
    const facetQuery = {
      ...omitFacetField(normalizedQuery, fieldName),
      [fieldName]: value
    };
    const library = this.requestRepository.listTrackedRequestLibrary({
      statuses: resolveStatuses(facetQuery.status),
      client: facetQuery.client,
      channel: facetQuery.channel,
      source: facetQuery.source,
      medium: facetQuery.medium,
      term: facetQuery.term,
      content: facetQuery.content,
      campaign: facetQuery.campaign,
      status: facetQuery.status || "all",
      search: facetQuery.search,
      qr: facetQuery.qr,
      shortLink: facetQuery.shortLink,
      sort: facetQuery.sort,
      limit: 1,
      offset: 0
    });
    return Number(library.summary?.filtered_links ?? 0) > 0;
  }

  async hasFacetResultsAsync(normalizedQuery, fieldName, value) {
    const facetQuery = {
      ...omitFacetField(normalizedQuery, fieldName),
      [fieldName]: value
    };
    const library = await (this.requestRepository.listTrackedRequestLibraryAsync?.({
      statuses: resolveStatuses(facetQuery.status),
      client: facetQuery.client,
      channel: facetQuery.channel,
      source: facetQuery.source,
      medium: facetQuery.medium,
      term: facetQuery.term,
      content: facetQuery.content,
      campaign: facetQuery.campaign,
      status: facetQuery.status || "all",
      search: facetQuery.search,
      qr: facetQuery.qr,
      shortLink: facetQuery.shortLink,
      sort: facetQuery.sort,
      limit: 1,
      offset: 0
    }) ?? this.requestRepository.listTrackedRequestLibrary({
      statuses: resolveStatuses(facetQuery.status),
      client: facetQuery.client,
      channel: facetQuery.channel,
      source: facetQuery.source,
      medium: facetQuery.medium,
      term: facetQuery.term,
      content: facetQuery.content,
      campaign: facetQuery.campaign,
      status: facetQuery.status || "all",
      search: facetQuery.search,
      qr: facetQuery.qr,
      shortLink: facetQuery.shortLink,
      sort: facetQuery.sort,
      limit: 1,
      offset: 0
    }));
    return Number(library.summary?.filtered_links ?? 0) > 0;
  }

  queueRefresh(cacheKey, query = {}) {
    if (!this.cache || this.inflight.has(cacheKey)) {
      return this.inflight.get(cacheKey) ?? null;
    }
    const work = new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const startedAt = Date.now();
          const result = await this.listAsync(query);
          this.cache.set(cacheKey, result, this.cacheTtlMs);
          this.logger?.debug?.("UTM library cache refreshed.", {
            cache_key: cacheKey,
            duration_ms: Date.now() - startedAt,
            total_items: Number(result.pagination?.total ?? 0)
          });
          resolve(result);
        } catch (error) {
          this.logger?.warning?.("UTM library cache refresh failed.", {
            cache_key: cacheKey,
            error: error?.message ?? String(error ?? "Unknown error")
          });
          resolve(null);
        } finally {
          this.inflight.delete(cacheKey);
        }
      }, 0);
    });
    this.inflight.set(cacheKey, work);
    return work;
  }

  mapRow(row) {
    return this.mapRequestRecord(row, {
      requestCount: row.request_count,
      firstCreatedAt: row.first_created_at,
      lastCreatedAt: row.last_created_at
    });
  }

  mapRequestRecord(row, overrides = {}) {
    const normalized = safeJsonParse(row.normalized_payload);
    const warnings = safeJsonArray(row.warnings);
    const missingFields = safeJsonArray(row.missing_fields);
    const finalLongUrl = normalized.final_long_url ?? row.final_long_url ?? "";
    const extractedUtms = extractUtms(finalLongUrl);
    const client = normalized.client ?? "unknown";
    const channel = normalized.channel ?? "unknown";

    return {
      requestId: Number(row.id),
      requestUuid: row.request_uuid,
      status: String(row.status ?? "").trim().toLowerCase(),
      fingerprint: row.fingerprint ?? null,
      client,
      clientDisplayName: normalized.client_display_name ?? humanizeLabel(client),
      channel,
      channelDisplayName: normalized.channel_display_name ?? humanizeLabel(channel),
      assetType: normalized.asset_type ?? null,
      campaignLabel: normalized.campaign_label ?? null,
      canonicalCampaign: normalized.canonical_campaign ?? extractedUtms.utm_campaign ?? "",
      utmSource: normalized.utm_source ?? extractedUtms.utm_source ?? "",
      utmMedium: normalized.utm_medium ?? extractedUtms.utm_medium ?? "",
      utmCampaign: normalized.utm_campaign ?? extractedUtms.utm_campaign ?? "",
      utmTerm: normalized.utm_term ?? extractedUtms.utm_term ?? "",
      utmContent: normalized.utm_content ?? extractedUtms.utm_content ?? "",
      destinationUrl: normalized.destination_url ?? normalized.normalized_destination_url ?? "",
      normalizedDestinationUrl: normalized.normalized_destination_url ?? "",
      finalLongUrl,
      shortUrl: row.short_url ?? "",
      qrUrl: row.qr_url ?? "",
      hasShortUrl: Boolean(String(row.short_url ?? "").trim()),
      hasQr: Boolean(String(row.qr_url ?? "").trim()),
      originalMessage: row.original_message ?? "",
      warnings,
      missingFields,
      requestCount: Number(overrides.requestCount ?? row.request_count ?? 1),
      firstCreatedAt: overrides.firstCreatedAt ?? row.first_created_at ?? row.created_at,
      lastCreatedAt: overrides.lastCreatedAt ?? row.last_created_at ?? row.created_at,
      reusedExisting: Number(row.reused_existing ?? 0) === 1
    };
  }
}

function safeJsonParse(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeJsonArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractUtms(url) {
  if (!url) {
    return {};
  }

  try {
    const parsed = new URL(url);
    return {
      utm_source: parsed.searchParams.get("utm_source") ?? "",
      utm_medium: parsed.searchParams.get("utm_medium") ?? "",
      utm_campaign: parsed.searchParams.get("utm_campaign") ?? "",
      utm_term: parsed.searchParams.get("utm_term") ?? "",
      utm_content: parsed.searchParams.get("utm_content") ?? ""
    };
  } catch {
    return {};
  }
}

function humanizeLabel(value) {
  return String(value ?? "")
    .split(/[_-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function normalizeLibraryQuery(query = {}) {
  return {
    page: positiveInteger(query.page, 1),
    perPage: clamp(positiveInteger(query.per_page, 50), 1, 200),
    client: normalizeFilterValue(query.client),
    channel: normalizeFilterValue(query.channel),
    source: normalizeTextValue(query.source),
    medium: normalizeTextValue(query.medium),
    term: normalizeTextValue(query.term),
    content: normalizeTextValue(query.content),
    campaign: normalizeTextValue(query.campaign),
    status: normalizeFilterValue(query.status),
    search: normalizeTextValue(query.search),
    qr: normalizeToggleValue(query.qr, "all"),
    shortLink: normalizeToggleValue(query.short_link, "all"),
    sort: normalizeSortValue(query.sort)
  };
}

function resolveStatuses(statusFilter) {
  return statusFilter && statusFilter !== "all"
    ? [statusFilter]
    : DEFAULT_STATUSES;
}

function omitFacetField(query, fieldName) {
  const next = { ...query };
  if (fieldName === "status") {
    next.status = "all";
    return next;
  }
  if (fieldName === "qr" || fieldName === "shortLink") {
    next[fieldName] = "all";
    return next;
  }
  next[fieldName] = fieldName === "client" || fieldName === "channel" ? "" : "";
  return next;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeFilterValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeTextValue(value) {
  return String(value ?? "").trim();
}

function normalizeToggleValue(value, fallback) {
  const normalized = normalizeFilterValue(value);
  return TOGGLE_FILTERS.includes(normalized) ? normalized : fallback;
}

function normalizeSortValue(value) {
  const normalized = normalizeFilterValue(value);
  return SORT_OPTIONS.includes(normalized) ? normalized : DEFAULT_SORT;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function compareDates(left, right) {
  const leftTime = Date.parse(String(left ?? "")) || 0;
  const rightTime = Date.parse(String(right ?? "")) || 0;
  return leftTime - rightTime;
}

function buildPendingLibrary(query = {}) {
  const page = positiveInteger(query.page, 1);
  const perPage = clamp(positiveInteger(query.per_page, 50), 1, 200);
  return {
    items: [],
    available: {
      clients: [],
      channels: [],
      sources: [],
      mediums: [],
      statuses: ["all", ...DEFAULT_STATUSES],
      qrStates: ["all", "with_qr", "without_qr"],
      shortLinkStates: ["all", "with_short_link", "without_short_link"],
      sorts: SORT_OPTIONS
    },
    filters: {
      client: normalizeFilterValue(query.client),
      channel: normalizeFilterValue(query.channel),
      source: normalizeTextValue(query.source),
      medium: normalizeTextValue(query.medium),
      term: normalizeTextValue(query.term),
      content: normalizeTextValue(query.content),
      campaign: normalizeTextValue(query.campaign),
      status: normalizeFilterValue(query.status) || "all",
      search: normalizeTextValue(query.search),
      qr: normalizeToggleValue(query.qr, "all"),
      shortLink: normalizeToggleValue(query.short_link, "all"),
      sort: normalizeSortValue(query.sort),
      perPage
    },
    pagination: {
      page,
      perPage,
      total: 0,
      pageCount: 1,
      hasPreviousPage: false,
      hasNextPage: false
    },
    summary: {
      totalUniqueLinks: 0,
      filteredLinks: 0,
      requestsRepresented: 0,
      withQr: 0,
      withoutShortLink: 0
    },
    pending: true,
    cache_status: "warming"
  };
}
