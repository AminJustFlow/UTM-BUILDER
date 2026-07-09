import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { formatUtmValue } from "./utm-value-format.js";

const UTM_FIELDS = ["campaign", "source", "medium", "term", "content"];
const DEFAULT_SUGGESTION_LIMIT = 8;
const DEFAULT_HISTORY_LIMIT = 6;

export class UtmIntelligenceService {
  constructor({ projectRoot, rulesService, generatedLinkRepository = null, requestRepository = null, currentYear = new Date().getFullYear() }) {
    this.projectRoot = projectRoot;
    this.rulesService = rulesService;
    this.generatedLinkRepository = generatedLinkRepository;
    this.requestRepository = requestRepository;
    this.currentYear = currentYear;
    this.staticData = this.loadStaticData();
    this.staticBaselineKnownValues = buildKnownValues(
      this.staticData.uiDictionaries,
      this.staticData.valueCounts,
      this.staticData.masterRows
    );
    this.runtimeRows = [];
    this.data = this.mergeRuntimeData(this.runtimeRows);
  }

  metadata({ client = null, channel = null } = {}) {
    this.refreshData();
    const scopedRows = this.scopeRows({ client, channel });
    const channelDefaults = channel ? this.rulesService.getSourceMedium(channel) ?? {} : {};
    const campaignSuggestions = this.suggestions({ field: "campaign", client, channel, limit: 12 }).items;

    return {
      fields: Object.fromEntries(UTM_FIELDS.map((field) => [field, {
        key: field,
        label: title(field),
        description: describeField(field)
      }])),
      summary: {
        historical_rows: scopedRows.length,
        known_campaigns: this.data.knownValues.campaign.length,
        known_sources: this.data.knownValues.source.length,
        known_mediums: this.data.knownValues.medium.length
      },
      channel_defaults: {
        source: normalizeOptional(channelDefaults.source),
        medium: normalizeOptional(channelDefaults.medium)
      },
      initial_suggestions: {
        campaign: campaignSuggestions,
        source: this.suggestions({
          field: "source",
          client,
          channel,
          campaign: normalizeOptional(campaignSuggestions[0]?.value),
          limit: 8
        }).items,
        medium: this.suggestions({
          field: "medium",
          client,
          channel,
          campaign: normalizeOptional(campaignSuggestions[0]?.value),
          limit: 8
        }).items
      }
    };
  }

  suggestions(input = {}) {
    this.refreshData();
    const field = normalizeField(input.field);
    if (!field) {
      return { items: [] };
    }

    const limit = clampNumber(input.limit, DEFAULT_SUGGESTION_LIMIT, 1, 20);
    const query = normalizeOptional(input.query);
    const filters = this.normalizeSelection(input);
    const scopedRows = this.scopeRows(filters);
    const candidateValues = this.collectCandidateValues(field, filters);

    const ranked = candidateValues
      .map((value) => this.buildSuggestion(field, value, scopedRows, filters))
      .filter(Boolean)
      .filter((item) => !query || item.normalized_value.includes(query))
      .sort(compareSuggestions)
      .slice(0, limit);

    return { items: ranked };
  }

  counts(input = {}) {
    this.refreshData();
    const filters = this.normalizeSelection(input);
    const scopedRows = this.scopeRows(filters);
    const byField = {};

    UTM_FIELDS.forEach((field) => {
      const value = filters[field];
      if (!value) {
        return;
      }
      byField[field] = this.countFieldValue(field, value, scopedRows);
    });

    return {
      fields: byField,
      selection: {
        total_matches: this.countExactMatches(scopedRows, filters),
        scoped_rows: scopedRows.length
      }
    };
  }

  similarHistory(input = {}) {
    this.refreshData();
    const filters = this.normalizeSelection(input);
    const scopedRows = this.scopeRows(filters);
    const limit = clampNumber(input.limit, DEFAULT_HISTORY_LIMIT, 1, 20);
    const hasTrackingSelection = UTM_FIELDS.some((field) => Boolean(filters[field]));
    const examples = scopedRows
      .map((row) => ({
        row,
        score: similarityScore(row, filters)
      }))
      .filter((entry) => !hasTrackingSelection || entry.score > 0)
      .sort((left, right) => right.score - left.score || compareDatesDesc(left.row.creationDate, right.row.creationDate))
      .slice(0, limit)
      .map((entry) => this.serializeHistoryRow(entry.row, entry.score));

    return {
      items: examples
    };
  }

  previousYearMatches(input = {}) {
    this.refreshData();
    const filters = this.normalizeSelection(input);
    const targetYear = clampNumber(input.year, this.currentYear - 1, 2000, this.currentYear + 10);
    const limit = clampNumber(input.limit, DEFAULT_HISTORY_LIMIT, 1, 20);
    const rows = this.scopeRows(filters)
      .filter((row) => row.creationYear === targetYear)
      .map((row) => ({
        row,
        score: similarityScore(row, filters)
      }))
      .filter((entry) => entry.score > 0 || hasAnySelection(filters))
      .sort((left, right) => right.score - left.score || compareDatesDesc(left.row.creationDate, right.row.creationDate))
      .slice(0, limit)
      .map((entry) => this.serializeHistoryRow(entry.row, entry.score));

    return {
      year: targetYear,
      items: rows
    };
  }

  combinationStats(input = {}) {
    this.refreshData();
    const filters = this.normalizeSelection(input);
    const scopedRows = this.scopeRows(filters);
    const exactCount = this.countExactMatches(scopedRows, filters);
    const examples = this.data.comboExamples
      .filter((row) => matchesRow(row, filters))
      .sort((left, right) => Number(right.count) - Number(left.count) || compareDatesDesc(left.latestCreationDate, right.latestCreationDate))
      .slice(0, 6)
      .map((row) => ({
        campaign: row.campaign,
        source: row.source,
        medium: row.medium,
        term: row.term,
        content: row.content,
        count: row.count,
        unique_urls: row.uniqueUrls,
        sample_url: row.sampleUrl,
        sample_client: row.client,
        latest_creation_date: row.latestCreationDate
      }));

    return {
      exact_match_count: exactCount,
      scoped_rows: scopedRows.length,
      campaign_summary: filters.campaign
        ? this.data.campaignSummary.get(filters.campaign) ?? null
        : null,
      examples
    };
  }

  context(input = {}) {
    this.refreshData();
    const filters = this.normalizeSelection(input);
    const recommendations = this.recommendations(filters);
    const policyWarnings = this.policyWarnings(filters, recommendations);
    const consistency = this.consistencyAnalysis(filters);
    return {
      counts: this.counts(filters),
      combination: this.combinationStats(filters),
      similar_history: this.similarHistory(filters),
      last_year: this.previousYearMatches(filters),
      recommendations,
      related_examples: {
        term: this.suggestions({ ...filters, field: "term", limit: 6 }).items,
        content: this.suggestions({ ...filters, field: "content", limit: 6 }).items
      },
      policy_warnings: policyWarnings,
      consistency,
      duplicate_warnings: UTM_FIELDS
        .map((field) => this.findNearDuplicate(field, filters[field]))
        .filter(Boolean)
    };
  }

  consistencyAnalysis(input = {}, acknowledgedRows = []) {
    this.refreshData();
    const filters = this.normalizeSelection(input);
    const client = filters.client;
    if (!client) return emptyConsistency();
    const clientRows = this.data.masterRows.filter((row) => row.client === client);
    const acknowledged = new Set((acknowledgedRows ?? []).map((row) => `${row.field}:${normalizeOptional(row.value)}`));
    const warnings = [];
    const newFields = new Set();

    for (const field of UTM_FIELDS) {
      const value = filters[field];
      if (!value) continue;
      const usageCount = clientRows.filter((row) => row[field] === value).length;
      if (usageCount > 0 || acknowledged.has(`${client}|${field}:${value}`)) continue;
      const near = this.findNearDuplicateForRows(field, value, clientRows)
        ?? this.findNearDuplicateForRows(field, value, this.data.masterRows);
      const recommendationRows = clientRows.length ? clientRows : this.data.masterRows;
      const globalExactCount = this.data.masterRows.filter((row) => row[field] === value).length;
      const displayValue = formatUtmValue(value);
      const displayNear = formatUtmValue(near);
      const recommendations = near
        ? [{ field, value: displayNear, normalized_value: near, usage_count: recommendationRows.filter((row) => row[field] === near).length }]
        : globalExactCount
          ? [{ field, value: displayValue, normalized_value: value, usage_count: globalExactCount }]
        : topValues(recommendationRows, field, 3).map((entry) => ({ field, ...entry }));
      warnings.push({
        type: near ? "possible_typo" : "new_value",
        severity: "warning",
        fields: [field],
        values: { [field]: value },
        message: near
          ? `${title(field)} "${displayValue}" looks close to the established client value "${displayNear}".`
          : `${title(field)} "${displayValue}" has never been used for this client.`,
        usage_count: 0,
        recommendations,
        requires_confirmation: true
      });
      newFields.add(field);
    }

    const pairs = [
      ["campaign", "source"], ["campaign", "medium"], ["source", "medium"],
      ["campaign", "term"], ["campaign", "content"]
    ];
    for (const fields of pairs) {
      if (fields.some((field) => !filters[field] || newFields.has(field))) continue;
      const usageCount = clientRows.filter((row) => fields.every((field) => row[field] === filters[field])).length;
      const valueKey = fields.map((field) => filters[field]).join("|");
      const acknowledgement = `${client}|pair:${fields.join("+")}:${valueKey}`;
      if (usageCount === 0 && !acknowledged.has(acknowledgement)) {
        const target = fields[fields.length - 1];
        const relatedRows = clientRows.filter((row) => row[fields[0]] === filters[fields[0]]);
        warnings.push({
          type: "new_pairing",
          severity: "warning",
          fields,
          values: Object.fromEntries(fields.map((field) => [field, filters[field]])),
          message: `${fields.map((field) => `${title(field)} "${formatUtmValue(filters[field])}"`).join(" with ")} has not been used for this client.`,
          usage_count: 0,
          recommendations: topValues(relatedRows, target, 3).map((entry) => ({ field: target, ...entry })),
          requires_confirmation: true
        });
      }
    }

    const populatedFields = UTM_FIELDS.filter((field) => filters[field]);
    const exactCount = clientRows.filter((row) => populatedFields.every((field) => row[field] === filters[field])).length;
    const combinationValue = populatedFields.map((field) => `${field}=${filters[field]}`).join("|");
    if (!newFields.size && !warnings.some((warning) => warning.type === "new_pairing") && exactCount === 0
      && !acknowledged.has(`${client}|combination:${combinationValue}`)) {
      warnings.push({
        type: "new_combination", severity: "warning", fields: populatedFields,
        values: Object.fromEntries(populatedFields.map((field) => [field, filters[field]])),
        message: "This complete UTM combination has never been used for this client.",
        usage_count: 0, recommendations: [], requires_confirmation: true
      });
    } else if (exactCount === 1) {
      warnings.push({
        type: "rare_combination", severity: "info", fields: populatedFields,
        values: Object.fromEntries(populatedFields.map((field) => [field, filters[field]])),
        message: "This UTM combination has only been used once for this client.",
        usage_count: 1, recommendations: [], requires_confirmation: false
      });
    }

    const confirmationWarnings = warnings.filter((warning) => warning.requires_confirmation);
    return {
      warnings,
      requires_confirmation: confirmationWarnings.length > 0,
      fingerprint: confirmationWarnings.length ? consistencyFingerprint(client, filters, confirmationWarnings) : null
    };
  }

  findNearDuplicateForRows(field, value, rows) {
    const values = [...new Set(rows.map((row) => row[field]).filter(Boolean))];
    const compact = compactValue(value);
    return values.find((candidate) => {
      if (candidate === value) return false;
      const candidateCompact = compactValue(candidate);
      return compact === candidateCompact || levenshtein(compact, candidateCompact) <= 2;
    }) ?? null;
  }

  recommendations(input = {}) {
    this.refreshData();
    const filters = this.normalizeSelection(input);
    return {
      source: this.topRecommendation("source", filters),
      medium: this.topRecommendation("medium", filters),
      term: this.topRecommendation("term", filters),
      content: this.topRecommendation("content", filters)
    };
  }

  topRecommendation(field, filters) {
    const items = this.suggestions({ ...filters, field, limit: 3 }).items;
    const top = items[0] ?? null;
    if (!top) {
      return null;
    }
    return {
      value: top.value,
      count: top.count,
      relation: top.relation,
      reason: recommendationReason(field, filters, top)
    };
  }

  policyWarnings(input = {}, recommendations = null) {
    const filters = this.normalizeSelection(input);
    const nextRecommendations = recommendations ?? this.recommendations(filters);
    const warnings = [];

    if (filters.campaign && filters.source) {
      const campaignSources = (this.data.maps.campaignSource.get(filters.campaign) ?? []).map((entry) => entry.value);
      if (campaignSources.length && !campaignSources.includes(filters.source)) {
        warnings.push({
          field: "source",
          message: `Source "${filters.source}" has not been used historically with campaign "${filters.campaign}".`
        });
      }
    }

    if (filters.campaign && filters.medium) {
      const campaignMediums = (this.data.maps.campaignMedium.get(filters.campaign) ?? []).map((entry) => entry.value);
      if (campaignMediums.length && !campaignMediums.includes(filters.medium)) {
        warnings.push({
          field: "medium",
          message: `Medium "${filters.medium}" is uncommon for campaign "${filters.campaign}".`
        });
      }
    }

    if (filters.source && filters.medium) {
      const sourceMediums = (this.data.maps.sourceMedium.get(filters.source) ?? []).map((entry) => entry.value);
      if (sourceMediums.length && !sourceMediums.includes(filters.medium)) {
        warnings.push({
          field: "medium",
          message: `Medium "${filters.medium}" has not been paired with source "${filters.source}" in the historical set.`
        });
      }
    }

    if (filters.campaign && !filters.source && nextRecommendations?.source?.value) {
      warnings.push({
        field: "source",
        message: `For campaign "${filters.campaign}", the most common source is "${nextRecommendations.source.value}".`
      });
    }

    if (filters.campaign && !filters.medium && nextRecommendations?.medium?.value) {
      warnings.push({
        field: "medium",
        message: `For campaign "${filters.campaign}", the most common medium is "${nextRecommendations.medium.value}".`
      });
    }

    return warnings;
  }

  isKnownValue(field, value) {
    this.refreshData();
    const normalizedField = normalizeField(field);
    const normalizedValue = normalizeOptional(value);
    if (!normalizedField || !normalizedValue) {
      return false;
    }
    return this.data.knownValues[normalizedField]?.includes(normalizedValue) ?? false;
  }

  isWorkbookBaselineValue(field, value) {
    const normalizedField = normalizeField(field);
    const normalizedValue = normalizeOptional(value);
    if (!normalizedField || !normalizedValue) {
      return false;
    }
    return this.staticBaselineKnownValues[normalizedField]?.includes(normalizedValue) ?? false;
  }

  previewFromNormalized(normalized, submitted = {}, acknowledgedRows = []) {
    this.refreshData();
    const filters = {
      client: normalizeOptional(normalized.client),
      channel: normalizeOptional(normalized.channel),
      campaign: normalizeOptional(normalized.utmCampaign),
      source: normalizeOptional(normalized.utmSource),
      medium: normalizeOptional(normalized.utmMedium),
      term: normalizeOptional(normalized.utmTerm),
      content: normalizeOptional(normalized.utmContent)
    };
    const duplicateWarnings = [
      this.findNearDuplicate("campaign", normalizeOptional(submitted.utm_campaign)),
      this.findNearDuplicate("source", normalizeOptional(submitted.utm_source)),
      this.findNearDuplicate("medium", normalizeOptional(submitted.utm_medium)),
      this.findNearDuplicate("term", normalizeOptional(submitted.utm_term)),
      this.findNearDuplicate("content", normalizeOptional(submitted.utm_content))
    ].filter(Boolean);

    return {
      resolved: {
        client: normalized.client,
        client_display_name: normalized.clientDisplayName,
        channel: normalized.channel,
        channel_display_name: normalized.channelDisplayName,
        destination_url: normalized.destinationUrl,
        normalized_destination_url: normalized.normalizedDestinationUrl,
        utm_source: normalized.utmSource,
        utm_medium: normalized.utmMedium,
        utm_campaign: normalized.utmCampaign,
        utm_term: normalized.utmTerm,
        utm_content: normalized.utmContent,
        final_long_url: normalized.finalLongUrl,
        needs_qr: normalized.needsQr,
        warnings: [...new Set([...(normalized.warnings ?? []), ...duplicateWarnings])]
      },
      context: {
        ...this.context(filters),
        consistency: this.consistencyAnalysis(filters, acknowledgedRows)
      }
    };
  }

  refreshData() {
    this.data = this.mergeRuntimeData(this.loadRuntimeRows());
    return this.data;
  }

  async refreshDataAsync() {
    this.runtimeRows = await this.loadRuntimeRowsAsync();
    this.data = this.mergeRuntimeData(this.runtimeRows);
    return this.data;
  }

  loadStaticData() {
    const dictionaryDir = path.join(this.projectRoot, "utm_dictionary_output");
    const cleanDir = path.join(this.projectRoot, "utm_clean_output");
    const uiDictionaries = readJson(path.join(dictionaryDir, "utm_ui_dictionaries.json"));
    const valueCounts = parseCsv(readText(path.join(dictionaryDir, "utm_value_counts.csv")))
      .map((row) => ({
        field: normalizeField(row.field),
        value: normalizeOptional(row[row.field] ?? row.value),
        count: toNumber(row.count),
        uniqueClients: toNumber(row.unique_clients)
      }))
      .filter((row) => row.field && row.value);
    const masterRows = parseCsv(readText(path.join(cleanDir, "utm_master_clean.csv")))
      .map((row) => this.normalizeMasterRow(row))
      .filter(Boolean);
    return {
      uiDictionaries,
      valueCounts,
      masterRows
    };
  }

  mergeRuntimeData(runtimeRows = this.runtimeRows) {
    const masterRows = [...this.staticData.masterRows, ...runtimeRows];
    const valueCounts = buildValueCounts(masterRows);
    return {
      ...this.staticData,
      masterRows,
      valueCounts,
      valueCountLookup: new Map(valueCounts.map((row) => [`${row.field}:${row.value}`, row])),
      knownValues: buildKnownValues(this.staticData.uiDictionaries, valueCounts, masterRows),
      maps: {
        campaignSource: buildMapFromRows(masterRows, "campaign", "source"),
        campaignMedium: buildMapFromRows(masterRows, "campaign", "medium"),
        sourceMedium: buildMapFromRows(masterRows, "source", "medium"),
        campaignTerm: buildMapFromRows(masterRows, "campaign", "term"),
        campaignContent: buildMapFromRows(masterRows, "campaign", "content")
      },
      comboExamples: buildComboExamples(masterRows),
      campaignSummary: buildCampaignSummary(masterRows)
    };
  }

  loadRuntimeRows() {
    if (this.requestRepository?.listConsistencyHistory) {
      return this.requestRepository.listConsistencyHistory().map((row) => this.normalizeRequestRow(row)).filter(Boolean);
    }
    if (!this.generatedLinkRepository) {
      return this.runtimeRows;
    }
    if (!this.canLoadRuntimeRowsSync()) {
      return this.runtimeRows;
    }
    const generatedRows = this.generatedLinkRepository.listAll?.() ?? [];
    return generatedRows
      .map((row) => this.normalizeGeneratedLinkRow(row))
      .filter(Boolean);
  }

  async loadRuntimeRowsAsync() {
    if (this.requestRepository?.listConsistencyHistoryAsync) {
      const rows = await this.requestRepository.listConsistencyHistoryAsync();
      return rows.map((row) => this.normalizeRequestRow(row)).filter(Boolean);
    }
    if (!this.generatedLinkRepository) {
      return this.runtimeRows;
    }
    if (typeof this.generatedLinkRepository.listAllAsync === "function") {
      const generatedRows = await this.generatedLinkRepository.listAllAsync();
      return generatedRows
        .map((row) => this.normalizeGeneratedLinkRow(row))
        .filter(Boolean);
    }
    return this.loadRuntimeRows();
  }

  canLoadRuntimeRowsSync() {
    const database = this.generatedLinkRepository?.database;
    return Boolean(this.generatedLinkRepository?.listAll) && database?.supportsPrepare !== false;
  }

  normalizeGeneratedLinkRow(row) {
    const destinationUrl = normalizeOptional(row.normalized_destination_url || extractDestinationUrl(row.final_long_url));
    const source = normalizeOptional(row.utm_source);
    const medium = normalizeOptional(row.utm_medium);
    const campaign = normalizeOptional(row.utm_campaign || row.canonical_campaign);
    const term = normalizeOptional(row.utm_term);
    const content = normalizeOptional(row.utm_content);
    if (!destinationUrl || !source || !medium || !campaign) {
      return null;
    }
    const creationDate = normalizeOptional(String(row.created_at ?? "").slice(0, 10));
    const creationYear = creationDate ? Number.parseInt(creationDate.slice(0, 4), 10) : null;
    return {
      destinationUrl,
      source,
      medium,
      campaign,
      term,
      content,
      client: normalizeOptional(row.client),
      channel: normalizeOptional(row.channel),
      creationDate,
      creationYear,
      bitly: normalizeOptional(row.short_url)
    };
  }

  normalizeRequestRow(row) {
    const normalized = safeObject(row.normalized_payload);
    return this.normalizeGeneratedLinkRow({
      normalized_destination_url: normalized.normalized_destination_url,
      final_long_url: normalized.final_long_url ?? row.final_long_url,
      utm_source: normalized.utm_source,
      utm_medium: normalized.utm_medium,
      utm_campaign: normalized.utm_campaign,
      canonical_campaign: normalized.canonical_campaign,
      utm_term: normalized.utm_term,
      utm_content: normalized.utm_content,
      client: normalized.client,
      channel: normalized.channel,
      created_at: row.created_at,
      short_url: row.short_url
    });
  }

  normalizeMasterRow(row) {
    const destinationUrl = normalizeOptional(row.destination_url);
    const source = normalizeOptional(row.source);
    const medium = normalizeOptional(row.medium);
    const campaign = normalizeOptional(row.campaign);
    const term = normalizeOptional(row.term);
    const content = normalizeOptional(row.content);
    if (!destinationUrl || !source || !medium || !campaign) {
      return null;
    }

    const client = this.normalizeHistoricalClient(row.client_code, destinationUrl);
    const channel = this.rulesService.normalizeChannel(null, null, medium === "qr_code", {
      source,
      medium
    });
    const creationDate = normalizeOptional(row.creation_date);
    const creationYear = creationDate ? Number.parseInt(creationDate.slice(0, 4), 10) : null;

    return {
      destinationUrl,
      source,
      medium,
      campaign,
      term,
      content,
      client,
      channel,
      creationDate,
      creationYear,
      bitly: normalizeOptional(row.bitly)
    };
  }

  normalizeHistoricalClient(rawClientCode, destinationUrl) {
    const code = normalizeOptional(rawClientCode);
    const direct = this.rulesService.normalizeClient(code, null);
    if (direct) {
      return direct;
    }
    const stripped = code ? code.replace(/_\d+$/u, "") : null;
    const fromStripped = this.rulesService.normalizeClient(stripped, null);
    if (fromStripped) {
      return fromStripped;
    }
    return this.rulesService.normalizeClient(null, destinationUrl);
  }

  normalizeSelection(input = {}) {
    return {
      client: normalizeOptional(input.client),
      channel: normalizeOptional(input.channel),
      campaign: normalizeOptional(input.campaign ?? input.utm_campaign),
      source: normalizeOptional(input.source ?? input.utm_source),
      medium: normalizeOptional(input.medium ?? input.utm_medium),
      term: normalizeOptional(input.term ?? input.utm_term),
      content: normalizeOptional(input.content ?? input.utm_content)
    };
  }

  scopeRows(filters = {}) {
    return this.data.masterRows.filter((row) => {
      if (filters.client && row.client !== filters.client) {
        return false;
      }
      if (filters.channel && row.channel !== filters.channel) {
        return false;
      }
      return true;
    });
  }

  collectCandidateValues(field, filters) {
    const candidates = new Set(this.data.knownValues[field] ?? []);
    if (field === "source" && filters.campaign) {
      for (const row of this.data.maps.campaignSource.get(filters.campaign) ?? []) {
        candidates.add(row.value);
      }
    }
    if (field === "medium" && filters.campaign) {
      for (const row of this.data.maps.campaignMedium.get(filters.campaign) ?? []) {
        candidates.add(row.value);
      }
    }
    if (field === "medium" && filters.source) {
      for (const row of this.data.maps.sourceMedium.get(filters.source) ?? []) {
        candidates.add(row.value);
      }
    }
    if (field === "term" && filters.campaign) {
      for (const row of this.data.maps.campaignTerm.get(filters.campaign) ?? []) {
        candidates.add(row.value);
      }
    }
    if (field === "content" && filters.campaign) {
      for (const row of this.data.maps.campaignContent.get(filters.campaign) ?? []) {
        candidates.add(row.value);
      }
    }

    return [...candidates];
  }

  buildSuggestion(field, value, scopedRows, filters) {
    const normalized = normalizeOptional(value);
    if (!normalized) {
      return null;
    }
    const global = this.data.valueCountLookup.get(`${field}:${normalized}`)?.count ?? 0;
    const scoped = countRows(scopedRows, field, normalized, filters);
    const relation = buildRelationLabel(field, normalized, filters, this.data.maps);
    const known = this.data.knownValues[field]?.includes(normalized) ?? false;
    const channelBoost = filters.channel ? this.channelValueBoost(field, normalized, filters.channel) : 0;
    const recommended = this.isRecommended(field, normalized, filters);

    return {
      value: formatUtmValue(normalized),
      normalized_value: normalized,
      count: scoped || global,
      global_count: global,
      scoped_count: scoped,
      channel_boost: channelBoost,
      relation,
      known,
      recommended,
      is_new: false
    };
  }

  isRecommended(field, value, filters) {
    if (field === "source" && filters.campaign) {
      return (this.data.maps.campaignSource.get(filters.campaign) ?? [])[0]?.value === value;
    }
    if (field === "medium" && filters.campaign) {
      return (this.data.maps.campaignMedium.get(filters.campaign) ?? [])[0]?.value === value;
    }
    if (field === "term" && filters.campaign) {
      return (this.data.maps.campaignTerm.get(filters.campaign) ?? [])[0]?.value === value;
    }
    if (field === "content" && filters.campaign) {
      return (this.data.maps.campaignContent.get(filters.campaign) ?? [])[0]?.value === value;
    }
    return false;
  }

  channelValueBoost(field, value, channel) {
    const defaults = this.rulesService.getSourceMedium(channel) ?? {};
    if (field === "source" && normalizeOptional(defaults.source) === value) {
      return 1;
    }
    if (field === "medium" && normalizeOptional(defaults.medium) === value) {
      return 1;
    }
    return 0;
  }

  countFieldValue(field, value, scopedRows) {
    const exact = countRows(scopedRows, field, value, {});
    const global = this.data.valueCountLookup.get(`${field}:${value}`)?.count ?? 0;
    return {
      value,
      count: exact,
      global_count: global
    };
  }

  countExactMatches(rows, filters) {
    return rows.filter((row) => matchesRow(row, filters)).length;
  }

  serializeHistoryRow(row, score) {
    return {
      destination_url: row.destinationUrl,
      campaign: row.campaign,
      source: row.source,
      medium: row.medium,
      term: row.term,
      content: row.content,
      client: row.client,
      channel: row.channel,
      creation_date: row.creationDate,
      score,
      bitly: row.bitly
    };
  }

  findNearDuplicate(field, value) {
    const normalized = normalizeOptional(value);
    if (!normalized) {
      return null;
    }
    const knownValues = this.data.knownValues[field] ?? [];
    if (knownValues.includes(normalized)) {
      return null;
    }
    const compact = compactValue(normalized);
    let best = null;
    for (const candidate of knownValues) {
      const candidateCompact = compactValue(candidate);
      if (compact === candidateCompact) {
        best = candidate;
        break;
      }
      const distance = levenshtein(compact, candidateCompact);
      if (distance <= 2) {
        best = candidate;
        break;
      }
    }
    if (!best) {
      return null;
    }
    return {
      field,
      entered: normalized,
      similar_to: formatUtmValue(best),
      message: `This ${field} looks close to existing "${formatUtmValue(best)}".`
    };
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function safeObject(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header = [], ...records] = rows;
  return records.map((values) => Object.fromEntries(header.map((key, position) => [key, values[position] ?? ""])));
}

function groupMapRows(rows, keyField, valueField) {
  const map = new Map();
  rows.forEach((row) => {
    const key = normalizeOptional(row[keyField]);
    const value = normalizeOptional(row[valueField]);
    if (!key || !value) {
      return;
    }
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push({
      value,
      count: toNumber(row.count),
      unique_clients: toNumber(row.unique_clients)
    });
  });
  for (const [key, items] of map.entries()) {
    map.set(key, items.sort((left, right) => Number(right.count) - Number(left.count) || left.value.localeCompare(right.value)));
  }
  return map;
}

function buildValueCounts(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    UTM_FIELDS.forEach((field) => {
      const value = normalizeOptional(row[field]);
      if (!value) {
        return;
      }
      const key = `${field}:${value}`;
      const current = counts.get(key) ?? {
        field,
        value,
        count: 0,
        clients: new Set()
      };
      current.count += 1;
      if (row.client) {
        current.clients.add(row.client);
      }
      counts.set(key, current);
    });
  });
  return [...counts.values()]
    .map((entry) => ({
      field: entry.field,
      value: entry.value,
      count: entry.count,
      uniqueClients: entry.clients.size
    }))
    .sort((left, right) => left.field.localeCompare(right.field) || right.count - left.count || left.value.localeCompare(right.value));
}

function buildMapFromRows(rows, keyField, valueField) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = normalizeOptional(row[keyField]);
    const value = normalizeOptional(row[valueField]);
    if (!key || !value) {
      return;
    }
    if (!grouped.has(key)) {
      grouped.set(key, new Map());
    }
    const entry = grouped.get(key);
    const current = entry.get(value) ?? {
      value,
      count: 0,
      clients: new Set()
    };
    current.count += 1;
    if (row.client) {
      current.clients.add(row.client);
    }
    entry.set(value, current);
  });
  return new Map([...grouped.entries()].map(([key, values]) => [
    key,
    [...values.values()]
      .map((entry) => ({
        value: entry.value,
        count: entry.count,
        unique_clients: entry.clients.size
      }))
      .sort((left, right) => Number(right.count) - Number(left.count) || left.value.localeCompare(right.value))
  ]));
}

function buildComboExamples(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = [row.campaign, row.source, row.medium, row.term, row.content].join("|");
    const current = grouped.get(key) ?? {
      campaign: row.campaign,
      source: row.source,
      medium: row.medium,
      term: row.term,
      content: row.content,
      count: 0,
      urls: new Set(),
      sampleUrl: row.destinationUrl,
      client: row.client,
      latestCreationDate: row.creationDate ?? ""
    };
    current.count += 1;
    if (row.destinationUrl) {
      current.urls.add(row.destinationUrl);
    }
    if (row.creationDate && (!current.latestCreationDate || Date.parse(row.creationDate) > Date.parse(current.latestCreationDate))) {
      current.latestCreationDate = row.creationDate;
    }
    if (!current.sampleUrl && row.destinationUrl) {
      current.sampleUrl = row.destinationUrl;
    }
    grouped.set(key, current);
  });
  return [...grouped.values()]
    .map((entry) => ({
      campaign: entry.campaign,
      source: entry.source,
      medium: entry.medium,
      term: entry.term,
      content: entry.content,
      count: entry.count,
      uniqueUrls: entry.urls.size,
      sampleUrl: entry.sampleUrl,
      client: entry.client,
      latestCreationDate: entry.latestCreationDate
    }))
    .sort((left, right) => Number(right.count) - Number(left.count) || compareDatesDesc(left.latestCreationDate, right.latestCreationDate));
}

function buildCampaignSummary(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const campaign = normalizeOptional(row.campaign);
    if (!campaign) {
      return;
    }
    const current = grouped.get(campaign) ?? {
      campaign,
      total_rows: 0,
      sources: new Set(),
      mediums: new Set(),
      terms: new Set(),
      contents: new Set(),
      clients: new Set()
    };
    current.total_rows += 1;
    if (row.source) current.sources.add(row.source);
    if (row.medium) current.mediums.add(row.medium);
    if (row.term) current.terms.add(row.term);
    if (row.content) current.contents.add(row.content);
    if (row.client) current.clients.add(row.client);
    grouped.set(campaign, current);
  });
  return new Map([...grouped.entries()].map(([campaign, entry]) => [
    campaign,
    {
      campaign,
      total_rows: entry.total_rows,
      unique_sources: entry.sources.size,
      unique_mediums: entry.mediums.size,
      unique_terms: entry.terms.size,
      unique_contents: entry.contents.size,
      unique_clients: entry.clients.size
    }
  ]));
}

function extractDestinationUrl(finalLongUrl) {
  try {
    if (!finalLongUrl) {
      return "";
    }
    const parsed = new URL(String(finalLongUrl));
    parsed.search = "";
    return normalizeOptional(parsed.toString().replace(/\/$/u, parsed.pathname === "/" ? "/" : ""));
  } catch {
    return "";
  }
}

function emptyConsistency() {
  return { warnings: [], requires_confirmation: false, fingerprint: null };
}

function topValues(rows, field, limit = 3) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = normalizeOptional(row[field]);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, usage_count]) => ({ value: formatUtmValue(value), normalized_value: value, usage_count }))
    .sort((left, right) => right.usage_count - left.usage_count || left.value.localeCompare(right.value))
    .slice(0, limit);
}

function consistencyFingerprint(client, filters, warnings) {
  const payload = {
    client,
    values: Object.fromEntries(UTM_FIELDS.map((field) => [field, filters[field] ?? ""])),
    warnings: warnings.map((warning) => ({ type: warning.type, fields: warning.fields, message: warning.message }))
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function buildKnownValues(uiDictionaries, valueCounts, masterRows) {
  const known = Object.fromEntries(UTM_FIELDS.map((field) => [field, new Set()]));
  for (const [field, entries] of Object.entries(uiDictionaries?.value_counts ?? {})) {
    if (!known[field]) {
      continue;
    }
    entries.forEach((entry) => {
      const value = normalizeOptional(entry.value);
      if (value) {
        known[field].add(value);
      }
    });
  }
  valueCounts.forEach((row) => {
    if (known[row.field]) {
      known[row.field].add(row.value);
    }
  });
  masterRows.forEach((row) => {
    known.campaign.add(row.campaign);
    known.source.add(row.source);
    known.medium.add(row.medium);
    if (row.term) {
      known.term.add(row.term);
    }
    if (row.content) {
      known.content.add(row.content);
    }
  });
  return Object.fromEntries(Object.entries(known).map(([field, values]) => [field, [...values].sort()]));
}

function normalizeOptional(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized || normalized === "nan" || normalized === "(none)") {
    return "";
  }
  return normalized;
}

function normalizeField(value) {
  const normalized = normalizeOptional(value);
  return UTM_FIELDS.includes(normalized) ? normalized : "";
}

function toNumber(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countRows(rows, field, value, filters = {}) {
  return rows.filter((row) => row[field] === value && matchesOtherFields(row, field, filters)).length;
}

function matchesOtherFields(row, currentField, filters) {
  return UTM_FIELDS.every((field) => {
    if (field === currentField) {
      return true;
    }
    if (!filters[field]) {
      return true;
    }
    return row[field] === filters[field];
  });
}

function matchesRow(row, filters) {
  return UTM_FIELDS.every((field) => !filters[field] || row[field] === filters[field]);
}

function similarityScore(row, filters) {
  let score = 0;
  UTM_FIELDS.forEach((field) => {
    if (filters[field] && row[field] === filters[field]) {
      score += field === "campaign" ? 5 : field === "source" || field === "medium" ? 3 : 1;
    }
  });
  return score;
}

function hasAnySelection(filters) {
  return UTM_FIELDS.some((field) => Boolean(filters[field])) || Boolean(filters.client) || Boolean(filters.channel);
}

function compareSuggestions(left, right) {
  return Number(right.scoped_count) - Number(left.scoped_count)
    || Number(right.channel_boost) - Number(left.channel_boost)
    || Number(right.global_count) - Number(left.global_count)
    || left.normalized_value.localeCompare(right.normalized_value);
}

function buildRelationLabel(field, value, filters, maps) {
  if (field === "source" && filters.campaign) {
    const match = (maps.campaignSource.get(filters.campaign) ?? []).find((entry) => entry.value === value);
    if (match) {
      return `Used with ${formatUtmValue(filters.campaign)} ${match.count} times`;
    }
  }
  if (field === "medium" && filters.campaign) {
    const match = (maps.campaignMedium.get(filters.campaign) ?? []).find((entry) => entry.value === value);
    if (match) {
      return `Used with ${formatUtmValue(filters.campaign)} ${match.count} times`;
    }
  }
  if (field === "medium" && filters.source) {
    const match = (maps.sourceMedium.get(filters.source) ?? []).find((entry) => entry.value === value);
    if (match) {
      return `Used with ${filters.source} ${match.count} times`;
    }
  }
  if (field === "term" && filters.campaign) {
    const match = (maps.campaignTerm.get(filters.campaign) ?? []).find((entry) => entry.value === value);
    if (match) {
      return `Common for ${formatUtmValue(filters.campaign)}`;
    }
  }
  if (field === "content" && filters.campaign) {
    const match = (maps.campaignContent.get(filters.campaign) ?? []).find((entry) => entry.value === value);
    if (match) {
      return `Common for ${formatUtmValue(filters.campaign)}`;
    }
  }
  return "";
}

function compactValue(value) {
  return String(value ?? "").replace(/[^a-z0-9]+/gu, "");
}

function levenshtein(left, right) {
  if (left === right) {
    return 0;
  }
  if (!left.length) {
    return right.length;
  }
  if (!right.length) {
    return left.length;
  }
  const matrix = Array.from({ length: right.length + 1 }, (_, row) => [row]);
  for (let column = 0; column <= left.length; column += 1) {
    matrix[0][column] = column;
  }
  for (let row = 1; row <= right.length; row += 1) {
    for (let column = 1; column <= left.length; column += 1) {
      const cost = left[column - 1] === right[row - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }
  return matrix[right.length][left.length];
}

function compareDatesDesc(left, right) {
  return (Date.parse(String(right ?? "")) || 0) - (Date.parse(String(left ?? "")) || 0);
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function title(value) {
  return String(value ?? "").charAt(0).toUpperCase() + String(value ?? "").slice(1);
}

function describeField(field) {
  const descriptions = {
    campaign: "Strategic bucket, such as collateral.",
    source: "Specific asset, such as cic_rack_card.",
    medium: "Access method, such as qr_code.",
    term: "Optional qualifier for intentional segmentation.",
    content: "Optional creative or placement detail."
  };
  return descriptions[field] ?? "";
}

function recommendationReason(field, filters, top) {
  if (filters.campaign) {
    return `${title(field)} most often paired with ${filters.campaign}.`;
  }
  if (filters.source && field === "medium") {
    return `Most common medium for ${filters.source}.`;
  }
  return `Most common historical ${field}.`;
}
