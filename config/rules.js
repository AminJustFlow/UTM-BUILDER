import workbookTaxonomy from "./workbook-taxonomy.js";

const manualClients = {
  studleys: {
    displayName: "Studleys",
    aliases: ["studley", "studleys", "studley's", "sfg"],
    domains: ["studleys.com", "plants.studleys.com", "studleys.isolvedhire.com"],
    taxonomyKey: "sfg",
    utmDefaults: {
      website: {
        source: "Navigation",
        medium: "Website",
        campaign: "PlantFinder",
        term: "",
        content: "PlantFinder"
      }
    },
    guidance: {
      summary: "Use the highest-priority Studleys campaign that fits the destination and message. The campaign standards below explain when to use each bucket and how to name Term and Content.",
      fields: {
        campaign: {
          label: "Campaign — Studleys reporting bucket",
          help: "Choose the highest-priority campaign that accurately describes the page or promotion.",
          placeholder: "Floral"
        }
      },
      campaignProfiles: [
        {
          priority: 1,
          campaign: "LimitedCampaign",
          guideline: "Use sparingly and only when determined by Ami or Matt. Example: GardenTour."
        },
        ...["Floral", "Houseplants", "GardenCenter", "Wedding", "Landscaping", "PlantFinder", "About"].map((campaign) => ({
          priority: 1,
          campaign,
          guideline: "Use for pages and products within this section of the website.",
          fields: {
            term: {
              label: "Term — Page or product",
              help: "Use LandingPage, the product category, or the specific product name.",
              placeholder: "LandingPage"
            },
            content: {
              label: "Content — Message or CTA",
              help: "Use the call to action or the messaging used to engage the audience.",
              placeholder: "LearnMore"
            }
          }
        })),
        {
          priority: 1,
          campaign: "MetaAdCampaignName",
          displayName: "Meta Ad campaign name",
          guideline: "Use the Meta campaign name with no punctuation, spaces, or date.",
          source: "MetaAd",
          medium: "Social",
          fields: {
            term: {
              label: "Term — Meta ad set",
              help: "Use the Meta ad set name, excluding the campaign name.",
              placeholder: "AdSetName"
            },
            content: {
              label: "Content — Meta creative type",
              help: "Identify the creative format.",
              placeholder: "Static"
            }
          }
        },
        {
          priority: 2,
          campaign: "Community",
          guideline: "Use only for community events, awards, donations, and similar community activity.",
          fields: {
            term: {
              label: "Term — Community item",
              help: "Use the name of the community event, award, donation, or initiative.",
              placeholder: "CommunityEventName"
            },
            content: {
              label: "Content — Message or CTA",
              help: "Use the call to action or the messaging used to engage the audience.",
              placeholder: "LearnMore"
            }
          }
        },
        {
          priority: 2,
          campaign: "Inspiration",
          displayName: "Inspiration (formerly News)",
          aliases: ["News"],
          guideline: "Use for inspirational or editorial content. Choose the most relevant area of business for cross-functional articles.",
          fields: {
            term: {
              label: "Term — Area of business",
              help: "Use the area of business, such as Floral, Houseplants, GardenCenter, or Landscaping.",
              placeholder: "Floral"
            },
            content: {
              label: "Content — Message or CTA",
              help: "Use the call to action or the messaging used to engage the audience.",
              placeholder: "ReadMore"
            }
          }
        },
        {
          priority: 3,
          campaign: "MobileLinks",
          guideline: "Use only for destinations under /links.",
          fields: {
            content: {
              label: "Content — Link profile",
              help: "Use Profile when the destination represents a social profile.",
              placeholder: "Profile"
            }
          }
        },
        {
          priority: 3,
          campaign: "Website",
          guideline: "Use only for the home page unless another page does not fit a priority 1 campaign.",
          fields: {
            term: {
              label: "Term — Website page",
              help: "Use HomePage for the website home page.",
              placeholder: "HomePage"
            }
          }
        }
      ]
    }
  },
  gas: {
    displayName: "GAS",
    aliases: ["gas", "guardian angel", "guardian angel senior services"],
    domains: ["guardianangelseniorservices.com"],
    taxonomyKey: "gas",
    guidance: {
      summary: "Use the highest-priority GAS campaign that fits the destination. Campaign standards are guidance for consistent reporting and do not block link creation.",
      fields: {
        campaign: {
          label: "Campaign — GAS reporting bucket",
          help: "Choose the highest-priority campaign that accurately describes the destination or promotion.",
          placeholder: "About"
        }
      },
      campaignProfiles: [
        {
          priority: 1,
          campaign: "LimitedCampaign",
          displayName: "Limited Campaign",
          guideline: "Use sparingly and only when determined by Ami or Matt. Example: GUIDE."
        },
        {
          priority: 1,
          campaign: "MetaAdCampaignName",
          displayName: "Meta Ad campaign name",
          guideline: "Use the Meta campaign name with no punctuation, spaces, or date. Example: Recruiting.",
          source: "MetaAd",
          medium: "Social",
          fields: {
            term: {
              label: "Term — Meta ad set",
              help: "Use the Meta ad set name minus the campaign name, plus location when applicable.",
              placeholder: "AdSetNameLocation"
            },
            content: {
              label: "Content — Creative type",
              help: "Identify the creative format as Static, Video, or Carousel.",
              placeholder: "Static"
            }
          }
        },
        ...["About", "Services"].map((campaign) => ({
          priority: 1,
          campaign,
          guideline: "Use for pages within this section of the website.",
          fields: {
            term: {
              label: "Term — Landing page",
              help: "Use LandingPage or the page name.",
              placeholder: "LandingPage"
            },
            content: {
              label: "Content — Message or CTA",
              help: "Use the call to action or messaging used to engage.",
              placeholder: "LearnMore"
            }
          }
        })),
        {
          priority: 1,
          campaign: "Careers",
          guideline: "Use for pages within the Careers section of the website.",
          fields: {
            term: {
              label: "Term — Position or role",
              help: "Use the position or role being promoted.",
              placeholder: "RegisteredNurse"
            },
            content: {
              label: "Content — Message or CTA",
              help: "Use the call to action or messaging used to engage.",
              placeholder: "ApplyNow"
            }
          }
        },
        {
          priority: 1,
          campaign: "Shop",
          guideline: "Use for pages within the Shop section of the website.",
          fields: {
            term: {
              label: "Term — Shop page",
              help: "Use LandingPage, Accessories, or Apparel.",
              placeholder: "LandingPage"
            },
            content: {
              label: "Content — Message or CTA",
              help: "Use the call to action or messaging used to engage.",
              placeholder: "ShopNow"
            }
          }
        },
        {
          priority: 1,
          campaign: "Contact",
          guideline: "Use for pages within the Contact section of the website.",
          fields: {
            term: {
              label: "Term — Contact page",
              help: "Use LandingPage.",
              placeholder: "LandingPage"
            },
            content: {
              label: "Content — Message or CTA",
              help: "Use the call to action or messaging used to engage.",
              placeholder: "ContactUs"
            }
          }
        },
        {
          priority: 2,
          campaign: "News",
          guideline: "Use for news content. Category and cross-functional article rules still need final business confirmation.",
          fields: {
            term: {
              label: "Term — News category",
              help: "Use the article category once the category standard is finalized.",
              placeholder: "CategoryTBD"
            },
            content: {
              label: "Content — Message or CTA",
              help: "Use the call to action or messaging used to engage.",
              placeholder: "ReadMore"
            }
          }
        },
        {
          priority: 3,
          campaign: "MobileLinks",
          guideline: "Use only for /links destinations. This is not currently used on the GAS website.",
          fields: {
            content: {
              label: "Content — Link profile",
              help: "Use Profile when the destination represents a social profile.",
              placeholder: "Profile"
            }
          }
        },
        {
          priority: 3,
          campaign: "Website",
          guideline: "Use only for the home page unless another page does not fit a priority 1 campaign.",
          fields: {
            term: {
              label: "Term — Website page",
              help: "Use HomePage for the website home page.",
              placeholder: "HomePage"
            },
            content: {
              label: "Content — Social profile",
              help: "Use Profile when the link is used on a social profile.",
              placeholder: "Profile"
            }
          }
        }
      ]
    }
  },
  jf: {
    displayName: "JF",
    aliases: ["jf", "just flow", "justflow"],
    domains: ["justflownh.com"],
    taxonomyKey: "jf"
  },
  castle: {
    displayName: "Castle In The Clouds",
    aliases: ["castle", "castle in the clouds", "castleintheclouds", "cic"],
    domains: ["castleintheclouds.org"],
    taxonomyKey: "cic",
    guidance: {
      summary: "Use the highest-priority Castle campaign that fits the destination. Campaign standards keep website, event, development, education, and advertising reporting consistent.",
      fields: {
        campaign: {
          label: "Campaign — Castle reporting bucket",
          help: "Choose the highest-priority campaign that accurately describes the destination or promotion.",
          placeholder: "Visit"
        }
      },
      campaignProfiles: [
        {
          priority: 1,
          campaign: "LimitedCampaign",
          displayName: "Limited Campaign",
          guideline: "Use sparingly and only when determined by Ami or Amin. Example: GardenTour."
        },
        {
          priority: 1,
          campaign: "MetaAdCampaignName",
          displayName: "Meta Ad campaign name",
          guideline: "Use the Meta campaign name with no punctuation, spaces, or date. Example: EveryDayFlowers.",
          source: "MetaAd",
          medium: "Social",
          fields: {
            term: { label: "Term — Meta ad set", help: "Use the Meta ad set name without the campaign name.", placeholder: "AdSetName" },
            content: { label: "Content — Creative type", help: "Identify the creative format as Static, Video, or Carousel.", placeholder: "Static" }
          }
        },
        {
          priority: 1,
          campaign: "HomePage",
          guideline: "Use only for the Castle home page.",
          fields: {
            term: { label: "Term — Website page", help: "Use LandingPage for the home page.", placeholder: "LandingPage" },
            content: { label: "Content — Message or CTA", help: "Use Learn, Explore, or leave blank when no distinct CTA applies.", placeholder: "Learn" }
          }
        },
        ...[
          ["Visit", "HoursAndAdmission", "Use Visit, Learn, Explore, or leave blank."],
          ["ProgramsAndEvents", "UpcomingEvents", "Use the workbook-approved program or event CTA."],
          ["Dine", "CarriageHouseRestaurant", "Use Visit, Learn, Explore, Buy, or leave blank as appropriate."],
          ["WeddingsAndEvents", "CastleWeddings", "Use Learn, Explore, or leave blank."],
          ["Support", "Donate", "Use Support, Learn, Donate, Join, Sponsor, Volunteer, or leave blank as appropriate."],
          ["About", "History", "Use Learn, Explore, Contact, or leave blank as appropriate."]
        ].map(([campaign, termExample, contentHelp]) => ({
          priority: 1,
          campaign,
          guideline: "Use for stable pages within this section of the Castle website.",
          fields: {
            term: { label: "Term — Website page", help: "Use LandingPage or the compact page name from the approved taxonomy.", placeholder: termExample },
            content: { label: "Content — Message or CTA", help: contentHelp, placeholder: campaign === "Support" ? "Support" : "Learn" }
          }
        })),
        {
          priority: 2,
          campaign: "Calendar",
          guideline: "Use for events that do not fit ProgramsAndEvents or an Education-specific campaign.",
          fields: { term: { label: "Term — Event name", help: "Use the compact event name.", placeholder: "GuidedTours" } }
        },
        {
          priority: 2,
          campaign: "Ads",
          guideline: "Use only for paid advertising placements unrelated to a more specific campaign.",
          fields: {
            term: { label: "Term — Issue or section", help: "Use the issue or sub-publication name; repeat the publication when appropriate.", placeholder: "SpringIssue" }
          }
        },
        ...[
          ["Collateral", "Use only for collateral produced specifically for Castle in the Clouds.", "WebsitePageName"],
          ["Development", "Use only for development campaigns, not general website links.", "WebsitePageName"],
          ["Education", "Use only for education-specific topics and programs.", "ProgramName"],
          ["News", "Use for a specific press or news topic.", "Topic"]
        ].map(([campaign, guideline, placeholder]) => ({
          priority: 2,
          campaign,
          guideline,
          fields: { term: { label: "Term — Campaign detail", help: "Use the relevant website page, program, or topic.", placeholder } }
        })),
        {
          priority: 3,
          campaign: "MobileLinks",
          guideline: "Use only for destinations under /links.",
          fields: {
            term: { label: "Term — Mobile links page", help: "Use LandingPage for the mobile links landing page.", placeholder: "LandingPage" },
            content: { label: "Content — Link type", help: "Use Profile when the destination is a social or publication profile.", placeholder: "Profile" }
          }
        },
        {
          priority: 4,
          campaign: "Website",
          guideline: "Use only when no priority 1–3 campaign fits, after review with Ami or Amin."
        }
      ]
    }
  },
  "900": {
    displayName: "900",
    aliases: ["900", "900 degrees", "900degrees"],
    domains: ["900degrees.com"],
    taxonomyKey: "900"
  },
  aaa: {
    displayName: "AAA",
    aliases: ["aaa", "aaa pump", "aaa pump service"],
    domains: ["aaapumpservice.com"],
    taxonomyKey: "aaa"
  },
  woodstone: {
    displayName: "Woodstone",
    aliases: ["woodstone", "woodstone homes"],
    domains: ["woodstonehomesnh.com"]
  },
  serenity: {
    displayName: "Serenity",
    aliases: ["serenity"],
    domains: []
  }
};

const staticChannels = {
  facebook: {
    displayName: "Facebook",
    aliases: ["facebook", "fb"],
    assetType: "social",
    requiresQr: false,
    utmDefaults: {
      source: "Facebook",
      medium: "Social",
      campaign: null,
      term: "",
      content: ""
    }
  },
  instagram: {
    displayName: "Instagram",
    aliases: ["instagram", "ig"],
    assetType: "social",
    requiresQr: false,
    utmDefaults: {
      source: "Instagram",
      medium: "Social",
      campaign: null,
      term: "",
      content: ""
    }
  },
  linkedin: {
    displayName: "LinkedIn",
    aliases: ["linkedin", "li"],
    assetType: "social",
    requiresQr: false,
    utmDefaults: {
      source: "LinkedIn",
      medium: "Social",
      campaign: null,
      term: "",
      content: ""
    }
  },
  email: {
    displayName: "Email",
    aliases: ["email", "newsletter"],
    assetType: "email",
    requiresQr: false,
    utmDefaults: {
      source: "Newsletter",
      medium: "Email",
      campaign: null,
      term: "",
      content: ""
    }
  },
  pr: {
    displayName: "PR",
    aliases: ["pr", "press"],
    assetType: "pr",
    requiresQr: false,
    utmDefaults: {
      source: "Press",
      medium: "PR",
      campaign: null,
      term: "",
      content: ""
    }
  },
  qr: {
    displayName: "QR",
    aliases: ["qr", "flyer", "print", "brochure", "postcard"],
    assetType: "offline",
    requiresQr: true,
    utmDefaults: {
      source: "QR",
      medium: "Offline",
      campaign: null,
      term: "",
      content: ""
    }
  },
  google_ads: {
    displayName: "Google Ads",
    aliases: ["google ads", "gads", "google_ads", "googleads"],
    assetType: "paid",
    requiresQr: false,
    utmDefaults: {
      source: "Google",
      medium: "CPC",
      campaign: null,
      term: "",
      content: ""
    }
  },
  website: {
    displayName: "Website",
    aliases: ["website", "site", "navigation", "plant finder", "plantfinder"],
    assetType: "owned",
    requiresQr: false,
    utmDefaults: {
      source: "Website",
      medium: "Website",
      campaign: "Website",
      term: "",
      content: ""
    }
  },
  domain: {
    displayName: "Domain",
    aliases: ["domain", "direct", "vanity domain"],
    assetType: "owned",
    requiresQr: false,
    utmDefaults: {
      source: "Domain",
      medium: "Domain",
      campaign: "Website",
      term: "",
      content: ""
    }
  }
};

const manualTaxonomyMappings = new Set(
  Object.values(manualClients)
    .map((client) => client.taxonomyKey)
    .filter(Boolean)
);

const workbookClients = Object.fromEntries(
  Object.entries(workbookTaxonomy.clients ?? {})
    .filter(([key]) => !manualTaxonomyMappings.has(key))
    .map(([key, client]) => [
      key,
      {
        displayName: client.displayName,
        aliases: uniqueValues([client.code, client.displayName, key]),
        domains: extractDomains(client.exampleDestinations ?? []),
        taxonomyKey: key
      }
    ])
);

const clients = attachTaxonomy({
  ...workbookClients,
  ...manualClients
});

export default {
  assetTypes: ["social", "email", "pr", "offline", "paid", "owned"],
  workbookTaxonomy,
  clients,
  channels: staticChannels,
  campaignLabelAliases: {
    guide: "guide",
    flyer: "flyer",
    brochure: "brochure"
  }
};

function attachTaxonomy(clientsByKey) {
  return Object.fromEntries(
    Object.entries(clientsByKey).map(([key, client]) => {
      return [key, {
        ...client,
        taxonomy: null
      }];
    })
  );
}

function extractDomains(urls) {
  const domains = new Set();

  urls.forEach((url) => {
    try {
      domains.add(new URL(url).hostname.toLowerCase());
    } catch {
      // ignore invalid workbook examples
    }
  });

  return [...domains];
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()))];
}
