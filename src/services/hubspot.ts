import { Client } from "@hubspot/api-client";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/contacts/models/Filter";
import { AssociationSpecAssociationCategoryEnum } from "@hubspot/api-client/lib/codegen/crm/deals/models/AssociationSpec";

export function createHubspotClient(accessToken: string) {
  return new Client({ accessToken });
}

/**
 * Pull contacts from HubSpot that should be excluded (existing clients, contacts)
 */
export async function pullExclusions(
  accessToken: string
): Promise<Array<{ type: "HUBSPOT_CLIENT" | "HUBSPOT_CONTACT"; value: string; hubspotId: string }>> {
  const client = createHubspotClient(accessToken);
  const exclusions: Array<{ type: "HUBSPOT_CLIENT" | "HUBSPOT_CONTACT"; value: string; hubspotId: string }> = [];

  // Pull contacts with lifecyclestage = customer → exclude their domains
  try {
    let after: string | undefined;
    do {
      const response = await client.crm.contacts.searchApi.doSearch({
        filterGroups: [
          {
            filters: [
              {
                propertyName: "lifecyclestage",
                operator: FilterOperatorEnum.Eq,
                value: "customer",
              },
            ],
          },
        ],
        properties: ["email", "company"],
        limit: 100,
        after: after || "0",
        sorts: [],
      });

      for (const contact of response.results) {
        const email = contact.properties.email;
        if (email) {
          const domain = email.split("@")[1]?.toLowerCase();
          if (domain) {
            exclusions.push({
              type: "HUBSPOT_CLIENT",
              value: domain,
              hubspotId: contact.id,
            });
          }
        }
      }

      after = response.paging?.next?.after;
    } while (after);
  } catch (err) {
    console.error("HubSpot pull customers error:", err);
  }

  // Pull all contacts → exclude their emails
  try {
    let after: string | undefined;
    do {
      const response = await client.crm.contacts.searchApi.doSearch({
        filterGroups: [],
        properties: ["email"],
        limit: 100,
        after: after || "0",
        sorts: [],
      });

      for (const contact of response.results) {
        const email = contact.properties.email?.toLowerCase();
        if (email) {
          exclusions.push({
            type: "HUBSPOT_CONTACT",
            value: email,
            hubspotId: contact.id,
          });
        }
      }

      after = response.paging?.next?.after;
    } while (after);
  } catch (err) {
    console.error("HubSpot pull contacts error:", err);
  }

  return exclusions;
}

/**
 * Push a qualified/interested lead to HubSpot as a contact + deal
 */
export async function pushLeadToHubspot(
  accessToken: string,
  lead: {
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    companyName: string;
    companyDomain: string;
    companyIndustry: string | null;
    companyCountry: string | null;
    aiRelevanceScore: number | null;
    status: string;
  }
): Promise<{ contactId: string; dealId?: string }> {
  const client = createHubspotClient(accessToken);

  // Create or update contact
  let contactId: string;
  try {
    const existing = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            { propertyName: "email", operator: FilterOperatorEnum.Eq, value: lead.email },
          ],
        },
      ],
      properties: ["email"],
      limit: 1,
      after: "0",
      sorts: [],
    });

    if (existing.results.length > 0) {
      contactId = existing.results[0].id;
      await client.crm.contacts.basicApi.update(contactId, {
        properties: {
          jobtitle: lead.jobTitle || "",
          company: lead.companyName,
          website: lead.companyDomain,
          country: lead.companyCountry || "",
        },
      });
    } else {
      const created = await client.crm.contacts.basicApi.create({
        properties: {
          email: lead.email,
          firstname: lead.firstName,
          lastname: lead.lastName,
          jobtitle: lead.jobTitle || "",
          company: lead.companyName,
          website: lead.companyDomain,
          country: lead.companyCountry || "",
        },
        associations: [],
      });
      contactId = created.id;
    }
  } catch (err) {
    throw new Error(`HubSpot contact creation failed: ${err}`);
  }

  // Create deal if lead is interested
  let dealId: string | undefined;
  if (lead.status === "INTERESTED" || lead.status === "MEETING_BOOKED") {
    try {
      const deal = await client.crm.deals.basicApi.create({
        properties: {
          dealname: `KO-SDR: ${lead.companyName} - ${lead.firstName} ${lead.lastName}`,
          pipeline: "default",
          dealstage: "appointmentscheduled",
          description: `Lead generado por KO-SDR. Score: ${lead.aiRelevanceScore || "N/A"}`,
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              {
                associationCategory: AssociationSpecAssociationCategoryEnum.HubspotDefined,
                associationTypeId: 3, // deal-to-contact
              },
            ],
          },
        ],
      });
      dealId = deal.id;
    } catch (err) {
      console.error("HubSpot deal creation failed:", err);
    }
  }

  return { contactId, dealId };
}
