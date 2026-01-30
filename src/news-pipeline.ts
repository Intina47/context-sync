export type NewsSourceKind = 'api' | 'rss' | 'graphql';

export interface NewsSourceDefinition {
  id: string;
  name: string;
  kind: NewsSourceKind;
  category: 'tech-news' | 'product-launches';
  endpoint: string;
  description: string;
  attribution: string;
  enabled: boolean;
  tags: string[];
}

export interface NewsSectionDefinition {
  id: string;
  title: string;
  description: string;
  limit: number;
  sourceIds: string[];
}

export interface NewsPipelineDefinition {
  sources: NewsSourceDefinition[];
  sections: NewsSectionDefinition[];
}

export const NEWS_SOURCES: NewsSourceDefinition[] = [
  {
    id: 'product-hunt',
    name: 'Product Hunt',
    kind: 'graphql',
    category: 'product-launches',
    endpoint: 'https://api.producthunt.com/v2/api/graphql',
    description: 'Daily launches on Product Hunt, useful for highlighting new products.',
    attribution: 'Product Hunt API (requires token, free for approved apps).',
    enabled: true,
    tags: ['launches', 'products', 'startups'],
  },
  {
    id: 'morning-brew',
    name: 'Morning Brew',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://www.morningbrew.com/rss',
    description: 'Daily tech and business briefing with a concise format.',
    attribution: 'Morning Brew RSS feed.',
    enabled: true,
    tags: ['daily-briefing', 'business', 'tech'],
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://techcrunch.com/feed/',
    description: 'Startup and tech industry news.',
    attribution: 'TechCrunch RSS feed.',
    enabled: true,
    tags: ['startups', 'funding', 'industry'],
  },
  {
    id: 'the-verge',
    name: 'The Verge',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://www.theverge.com/rss/index.xml',
    description: 'Technology, science, and culture coverage.',
    attribution: 'The Verge RSS feed.',
    enabled: true,
    tags: ['consumer-tech', 'culture', 'gadgets'],
  },
  {
    id: 'ars-technica',
    name: 'Ars Technica',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://feeds.arstechnica.com/arstechnica/index',
    description: 'Deep technical analysis and industry reporting.',
    attribution: 'Ars Technica RSS feed.',
    enabled: true,
    tags: ['analysis', 'engineering', 'science'],
  },
  {
    id: 'wired',
    name: 'Wired',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://www.wired.com/feed/rss',
    description: 'Technology, business, and digital culture news.',
    attribution: 'Wired RSS feed.',
    enabled: true,
    tags: ['business', 'culture', 'innovation'],
  },
  {
    id: 'engadget',
    name: 'Engadget',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://www.engadget.com/rss.xml',
    description: 'Consumer tech news and product reviews.',
    attribution: 'Engadget RSS feed.',
    enabled: true,
    tags: ['gadgets', 'reviews', 'consumer-tech'],
  },
  {
    id: 'gizmodo',
    name: 'Gizmodo',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://gizmodo.com/rss',
    description: 'Tech and science news with a pop-culture angle.',
    attribution: 'Gizmodo RSS feed.',
    enabled: true,
    tags: ['science', 'culture', 'consumer-tech'],
  },
  {
    id: 'mit-technology-review',
    name: 'MIT Technology Review',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://www.technologyreview.com/feed/',
    description: 'Emerging tech and research-focused reporting.',
    attribution: 'MIT Technology Review RSS feed.',
    enabled: true,
    tags: ['research', 'emerging-tech', 'ai'],
  },
  {
    id: 'infoq',
    name: 'InfoQ',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://www.infoq.com/feed/',
    description: 'Software development news and trends.',
    attribution: 'InfoQ RSS feed.',
    enabled: true,
    tags: ['software', 'architecture', 'devops'],
  },
  {
    id: 'venturebeat',
    name: 'VentureBeat',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://venturebeat.com/feed/',
    description: 'Tech industry, AI, and startup coverage.',
    attribution: 'VentureBeat RSS feed.',
    enabled: true,
    tags: ['ai', 'startups', 'enterprise'],
  },
  {
    id: 'zdnet',
    name: 'ZDNet',
    kind: 'rss',
    category: 'tech-news',
    endpoint: 'https://www.zdnet.com/news/rss.xml',
    description: 'Enterprise tech news and analysis.',
    attribution: 'ZDNet RSS feed.',
    enabled: true,
    tags: ['enterprise', 'it', 'security'],
  },
];

export const NEWS_SECTIONS: NewsSectionDefinition[] = [
  {
    id: 'tech-news',
    title: 'Tech News',
    description: 'Aggregated tech news from free, always-on sources.',
    limit: 60,
    sourceIds: NEWS_SOURCES.filter((source) => source.category === 'tech-news').map((source) => source.id),
  },
  {
    id: 'product-hunt-top-five',
    title: 'Top 5 Product Hunt Launches',
    description: 'Top five products launching today on Product Hunt.',
    limit: 5,
    sourceIds: ['product-hunt'],
  },
];

export const NEWS_PIPELINE: NewsPipelineDefinition = {
  sources: NEWS_SOURCES,
  sections: NEWS_SECTIONS,
};

export const NEWS_SOURCE_MAP = Object.fromEntries(
  NEWS_SOURCES.map((source) => [source.id, source]),
) as Record<string, NewsSourceDefinition>;

export function getEnabledNewsSources(): NewsSourceDefinition[] {
  return NEWS_SOURCES.filter((source) => source.enabled);
}

export function getSectionDefinition(sectionId: string): NewsSectionDefinition | undefined {
  return NEWS_SECTIONS.find((section) => section.id === sectionId);
}

export function getSourcesForSection(sectionId: string): NewsSourceDefinition[] {
  const section = getSectionDefinition(sectionId);
  if (!section) {
    return [];
  }
  return section.sourceIds
    .map((sourceId) => NEWS_SOURCE_MAP[sourceId])
    .filter((source): source is NewsSourceDefinition => Boolean(source));
}
