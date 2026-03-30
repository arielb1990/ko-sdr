import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hubspotSyncQueue } from "@/lib/queue";

/**
 * HubSpot webhook for contact/deal changes.
 * Triggers exclusion re-sync when contacts change lifecycle stage.
 */
export async function POST(request: Request) {
  const events = await request.json();

  // HubSpot sends an array of events
  const eventList = Array.isArray(events) ? events : [events];

  for (const event of eventList) {
    // If a contact's lifecycle stage changed to customer, trigger exclusion sync
    if (
      event.propertyName === "lifecyclestage" &&
      event.propertyValue === "customer"
    ) {
      // Find org by HubSpot contact → we need to figure out which org this belongs to
      // For now, trigger sync for all orgs with HubSpot configured
      const orgs = await prisma.organization.findMany({
        where: { hubspotAccessToken: { not: null } },
        select: { id: true },
      });

      for (const org of orgs) {
        await hubspotSyncQueue.add("hubspot-sync", {
          type: "pull-exclusions",
          organizationId: org.id,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
