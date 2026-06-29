export default {
  app: {
    name: "JF UTM Builder",
    debug: false,
    timezone: "America/New_York",
    confidenceThreshold: 0.72,
    slowRequestMs: 1500
  },
  database: {
    client: "postgres",
    url: "",
    sslEnabled: false,
    sslRejectUnauthorized: true
  },
  logging: {
    path: "storage/logs/app.log"
  },
  bitly: {
    accessToken: "",
    domain: "bit.ly",
    groupGuid: "",
    apiBase: "https://api-ssl.bitly.com/v4",
    timeoutMs: 8000
  },
  qr: {
    baseUrl: "https://api.qrserver.com/v1/create-qr-code/",
    size: "300x300"
  },
  libraryAuth: {
    enabled: false,
    username: "",
    password: "",
    realm: "Just Flow Marketing Hub"
  }
};
