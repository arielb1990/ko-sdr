import { describe, it, expect } from "vitest";
import { isExcluded } from "@/workers/discovery.worker";
import type { ApolloPerson } from "@/services/apollo";

function makePerson(overrides: Partial<ApolloPerson> = {}): ApolloPerson {
  return {
    id: "p1",
    first_name: "Juan",
    last_name: "Pérez",
    name: "Juan Pérez",
    title: "CTO",
    linkedin_url: null,
    email: "juan@testco.com",
    seniority: null,
    departments: [],
    organization_id: "o1",
    organization: {
      id: "o1",
      name: "TestCo",
      website_url: "https://testco.com",
      linkedin_url: null,
      primary_domain: "testco.com",
      estimated_num_employees: 100,
      industry: "Retail",
      country: "Argentina",
      city: "Buenos Aires",
      short_description: "Test company",
      annual_revenue_printed: null,
      technologies: [],
    },
    ...overrides,
  };
}

describe("isExcluded", () => {
  const emptySet = new Set<string>();

  it("excludes by existing Apollo ID", () => {
    const person = makePerson({ id: "existing-id" });
    const existingApolloIds = new Set(["existing-id"]);

    expect(
      isExcluded(person, emptySet, emptySet, emptySet, existingApolloIds, emptySet)
    ).toBe(true);
  });

  it("excludes by existing email", () => {
    const person = makePerson({ email: "juan@testco.com" });
    const existingEmails = new Set(["juan@testco.com"]);

    expect(
      isExcluded(person, emptySet, emptySet, emptySet, emptySet, existingEmails)
    ).toBe(true);
  });

  it("excludes by email in exclusion list", () => {
    const person = makePerson({ email: "juan@testco.com" });
    const excludedEmails = new Set(["juan@testco.com"]);

    expect(
      isExcluded(person, emptySet, excludedEmails, emptySet, emptySet, emptySet)
    ).toBe(true);
  });

  it("excludes by domain", () => {
    const person = makePerson();
    const excludedDomains = new Set(["testco.com"]);

    expect(
      isExcluded(person, excludedDomains, emptySet, emptySet, emptySet, emptySet)
    ).toBe(true);
  });

  it("excludes by company name (exact match lowercase)", () => {
    const person = makePerson();
    const excludedCompanies = new Set(["testco"]);

    expect(
      isExcluded(person, emptySet, emptySet, excludedCompanies, emptySet, emptySet)
    ).toBe(true);
  });

  it("excludes by company name (fuzzy - contains)", () => {
    const person = makePerson({
      organization: {
        ...makePerson().organization!,
        name: "Accenture Argentina S.A.",
      },
    });
    const excludedCompanies = new Set(["accenture"]);

    expect(
      isExcluded(person, emptySet, emptySet, excludedCompanies, emptySet, emptySet)
    ).toBe(true);
  });

  it("does NOT exclude when no matches", () => {
    const person = makePerson({
      id: "new-id",
      email: "new@newco.com",
      organization: {
        ...makePerson().organization!,
        name: "NewCo",
        primary_domain: "newco.com",
      },
    });

    const excludedDomains = new Set(["competitor.com"]);
    const excludedEmails = new Set(["other@example.com"]);
    const excludedCompanies = new Set(["globant"]);
    const existingApolloIds = new Set(["old-id"]);
    const existingEmails = new Set(["old@old.com"]);

    expect(
      isExcluded(
        person,
        excludedDomains,
        excludedEmails,
        excludedCompanies,
        existingApolloIds,
        existingEmails
      )
    ).toBe(false);
  });

  it("handles null email gracefully", () => {
    const person = makePerson({ email: null });

    expect(
      isExcluded(person, emptySet, emptySet, emptySet, emptySet, emptySet)
    ).toBe(false);
  });

  it("handles null organization gracefully", () => {
    const person = makePerson({
      organization: null,
      email: "test@unknown.com",
    });

    expect(
      isExcluded(person, emptySet, emptySet, emptySet, emptySet, emptySet)
    ).toBe(false);
  });

  it("is case-insensitive for email matching", () => {
    const person = makePerson({ email: "Juan@TestCo.COM" });
    const excludedEmails = new Set(["juan@testco.com"]);

    expect(
      isExcluded(person, emptySet, excludedEmails, emptySet, emptySet, emptySet)
    ).toBe(true);
  });
});
