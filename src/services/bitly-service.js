export class BitlyError extends Error {
  constructor(message, { statusCode = null, code = null, responseBody = null, cause = null } = {}) {
    super(message);
    this.name = "BitlyError";
    this.statusCode = statusCode;
    this.code = code;
    this.responseBody = responseBody;
    this.cause = cause;
  }
}

export class BitlyService {
  constructor(httpClient, config) {
    this.httpClient = httpClient;
    this.config = config;
  }

  async shorten(longUrl) {
    if (!this.config.accessToken) {
      throw new BitlyError("BITLY_ACCESS_TOKEN is not configured.", {
        code: "BITLY_NOT_CONFIGURED"
      });
    }

    const payload = {
      long_url: longUrl,
      domain: this.config.domain || "bit.ly",
      force_new_link: false
    };

    if (this.config.groupGuid) {
      payload.group_guid = this.config.groupGuid;
    }

    let response;
    try {
      response = await this.httpClient.request("POST", `${this.config.apiBase.replace(/\/$/u, "")}/shorten`, {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`
        },
        json: payload,
        timeoutMs: this.config.timeoutMs,
        retries: 2
      });
    } catch (error) {
      throw new BitlyError("Bitly request failed before a response was received.", {
        code: error?.name === "AbortError" ? "BITLY_TIMEOUT" : "BITLY_NETWORK_ERROR",
        cause: error
      });
    }

    if (response.statusCode >= 400) {
      const body = response.json();
      throw new BitlyError(`Bitly shorten failed with status ${response.statusCode}.`, {
        statusCode: response.statusCode,
        code: body.message ?? null,
        responseBody: body
      });
    }

    const body = response.json();
    if (!body.link) {
      throw new BitlyError("Bitly returned a response without a short link.", {
        statusCode: response.statusCode,
        code: "BITLY_INVALID_RESPONSE",
        responseBody: body
      });
    }
    return {
      link: body.link ?? "",
      id: body.id ?? null,
      payload: body
    };
  }
}
