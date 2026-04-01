import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApolloClient } from "@/services/apollo";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ApolloClient", () => {
  let client: ApolloClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ApolloClient("test-api-key");
  });

  describe("icpToFilters", () => {
    it("translates countries to Apollo location strings", () => {
      const filters = client.icpToFilters({
        countries: ["AR", "CL", "US"],
        employeeRanges: [],
        jobTitles: [],
        industries: [],
        excludeIndustries: [],
        keywords: [],
      });

      expect(filters.organization_locations).toEqual([
        "Argentina",
        "Chile",
        "United States",
      ]);
    });

    it("translates employee ranges to Apollo format", () => {
      const filters = client.icpToFilters({
        countries: [],
        employeeRanges: ["51-200", "201-500"],
        jobTitles: [],
        industries: [],
        excludeIndustries: [],
        keywords: [],
      });

      expect(filters.organization_num_employees_ranges).toEqual([
        "51,200",
        "201,500",
      ]);
    });

    it("passes job titles directly", () => {
      const filters = client.icpToFilters({
        countries: [],
        employeeRanges: [],
        jobTitles: ["CTO", "CMO", "Director de Ecommerce"],
        industries: [],
        excludeIndustries: [],
        keywords: [],
      });

      expect(filters.person_titles).toEqual([
        "CTO",
        "CMO",
        "Director de Ecommerce",
      ]);
    });

    it("passes keywords as organization keyword tags", () => {
      const filters = client.icpToFilters({
        countries: [],
        employeeRanges: [],
        jobTitles: [],
        industries: [],
        excludeIndustries: [],
        keywords: ["ecommerce", "transformación digital"],
      });

      expect(filters.q_organization_keyword_tags).toEqual(["ecommerce", "transformación digital"]);
    });

    it("omits empty arrays from filters", () => {
      const filters = client.icpToFilters({
        countries: [],
        employeeRanges: [],
        jobTitles: [],
        industries: [],
        excludeIndustries: [],
        keywords: [],
      });

      expect(filters.organization_locations).toBeUndefined();
      expect(filters.person_titles).toBeUndefined();
      expect(filters.organization_num_employees_ranges).toBeUndefined();
      expect(filters.q_keywords).toBeUndefined();
    });

    it("ignores unknown country codes", () => {
      const filters = client.icpToFilters({
        countries: ["AR", "XX", "ZZ"],
        employeeRanges: [],
        jobTitles: [],
        industries: [],
        excludeIndustries: [],
        keywords: [],
      });

      expect(filters.organization_locations).toEqual(["Argentina"]);
    });
  });

  describe("searchPeople", () => {
    it("sends correct request to Apollo API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            people: [{ id: "p1", first_name: "Juan" }],
            pagination: { page: 1, per_page: 100, total_entries: 1, total_pages: 1 },
          }),
      });

      const result = await client.searchPeople(
        { person_titles: ["CTO"] },
        1,
        50
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.apollo.io/api/v1/mixed_people/api_search",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-api-key": "test-api-key",
            "Content-Type": "application/json",
          }),
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.person_titles).toEqual(["CTO"]);
      expect(body.page).toBe(1);
      expect(body.per_page).toBe(50);

      expect(result.people).toHaveLength(1);
      expect(result.people[0].first_name).toBe("Juan");
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      await expect(
        client.searchPeople({ person_titles: ["CTO"] })
      ).rejects.toThrow("Apollo API error 401: Unauthorized");
    });
  });

  describe("searchAllPages", () => {
    it("fetches multiple pages", async () => {
      // Page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            people: Array(100).fill({ id: "p", first_name: "Test" }),
            pagination: { page: 1, per_page: 100, total_entries: 150, total_pages: 2 },
          }),
      });
      // Page 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            people: Array(50).fill({ id: "p", first_name: "Test" }),
            pagination: { page: 2, per_page: 100, total_entries: 150, total_pages: 2 },
          }),
      });

      const result = await client.searchAllPages({}, 3);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.people).toHaveLength(150);
      expect(result.totalFound).toBe(150);
    });

    it("respects maxPages limit", async () => {
      for (let i = 0; i < 2; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              people: Array(100).fill({ id: "p" }),
              pagination: { page: i + 1, per_page: 100, total_entries: 500, total_pages: 5 },
            }),
        });
      }

      const result = await client.searchAllPages({}, 2);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.people).toHaveLength(200);
    });
  });

  describe("enrichPerson", () => {
    it("sends enrichment request with correct params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            person: {
              id: "p1",
              email: "juan@example.com",
              personal_emails: [],
              phone_numbers: [],
            },
          }),
      });

      const result = await client.enrichPerson("p1");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.id).toBe("p1");
      expect(body.reveal_personal_emails).toBe(true);
      expect(result.person.email).toBe("juan@example.com");
    });
  });
});
