const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";

type ApolloSearchFilters = {
  person_titles?: string[];
  organization_locations?: string[];
  organization_num_employees_ranges?: string[];
  q_keywords?: string;
  page?: number;
  per_page?: number;
};

type ApolloPerson = {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  linkedin_url: string | null;
  email: string | null;
  seniority: string | null;
  departments: string[];
  organization_id: string | null;
  organization: {
    id: string;
    name: string;
    website_url: string | null;
    linkedin_url: string | null;
    primary_domain: string | null;
    estimated_num_employees: number | null;
    industry: string | null;
    country: string | null;
    city: string | null;
    short_description: string | null;
    annual_revenue_printed: string | null;
    technologies: string[];
  } | null;
};

type ApolloSearchResponse = {
  people: ApolloPerson[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
};

type ApolloEnrichResponse = {
  person: ApolloPerson & {
    email: string | null;
    personal_emails: string[];
    phone_numbers: Array<{ raw_number: string; sanitized_number: string }>;
  };
};

type IcpFilters = {
  countries: string[];
  employeeRanges: string[];
  jobTitles: string[];
  industries: string[];
  keywords: string[];
};

// Map country codes to Apollo location strings
const COUNTRY_MAP: Record<string, string> = {
  AR: "Argentina",
  UY: "Uruguay",
  CL: "Chile",
  EC: "Ecuador",
  PE: "Peru",
  PA: "Panama",
  GT: "Guatemala",
  CR: "Costa Rica",
  US: "United States",
  MX: "Mexico",
  CO: "Colombia",
  BR: "Brazil",
};

// Map employee ranges to Apollo format
const EMPLOYEE_RANGE_MAP: Record<string, string> = {
  "11-50": "11,50",
  "51-200": "51,200",
  "201-500": "201,500",
  "501-1000": "501,1000",
  "1001-5000": "1001,5000",
  "5001+": "5001,10000",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApolloClient {
  private apiKey: string;
  private lastRequestAt = 0;
  private minDelayMs = 3000; // 3 seconds between requests

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    await this.throttle();

    const res = await fetch(`${APOLLO_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Apollo API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Translate ICP config filters to Apollo API parameters
   */
  icpToFilters(icp: IcpFilters): ApolloSearchFilters {
    const filters: ApolloSearchFilters = {};

    if (icp.jobTitles.length > 0) {
      filters.person_titles = icp.jobTitles;
    }

    if (icp.countries.length > 0) {
      filters.organization_locations = icp.countries
        .map((code) => COUNTRY_MAP[code])
        .filter(Boolean);
    }

    if (icp.employeeRanges.length > 0) {
      filters.organization_num_employees_ranges = icp.employeeRanges
        .map((range) => EMPLOYEE_RANGE_MAP[range])
        .filter(Boolean);
    }

    if (icp.keywords.length > 0) {
      filters.q_keywords = icp.keywords.join(" ");
    }

    return filters;
  }

  /**
   * Search for people matching filters
   */
  async searchPeople(
    filters: ApolloSearchFilters,
    page = 1,
    perPage = 100
  ): Promise<ApolloSearchResponse> {
    return this.request<ApolloSearchResponse>(
      "/mixed_people/api_search",
      {
        ...filters,
        page,
        per_page: perPage,
      }
    );
  }

  /**
   * Enrich a single person to get email and phone
   */
  async enrichPerson(apolloId: string): Promise<ApolloEnrichResponse> {
    return this.request<ApolloEnrichResponse>("/people/match", {
      id: apolloId,
      reveal_personal_emails: true,
      reveal_phone_number: false,
    });
  }

  /**
   * Bulk enrich up to 10 people
   */
  async enrichBulk(
    details: Array<{
      id?: string;
      first_name?: string;
      last_name?: string;
      organization_name?: string;
      domain?: string;
    }>
  ): Promise<{ matches: ApolloEnrichResponse[] }> {
    return this.request("/people/bulk_match", {
      details,
      reveal_personal_emails: true,
      reveal_phone_number: false,
    });
  }

  /**
   * Search with automatic pagination, up to maxPages
   */
  async searchAllPages(
    filters: ApolloSearchFilters,
    maxPages = 3
  ): Promise<{ people: ApolloPerson[]; totalFound: number }> {
    const allPeople: ApolloPerson[] = [];
    let totalFound = 0;

    for (let page = 1; page <= maxPages; page++) {
      const response = await this.searchPeople(filters, page, 100);
      totalFound = response.pagination.total_entries;
      allPeople.push(...response.people);

      if (page >= response.pagination.total_pages) break;
    }

    return { people: allPeople, totalFound };
  }
}

export type { ApolloPerson, ApolloSearchFilters, IcpFilters };
