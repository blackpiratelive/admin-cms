import { describe, it, expect, beforeAll } from "vitest";
import { GET as getPeopleList, POST as createOrUpdatePerson } from "@/app/api/people/route";
import { GET as getPersonDetail, PUT as updatePerson, DELETE as deletePerson } from "@/app/api/people/[id]/route";
import { POST as toggleFavorite } from "@/app/api/people/[id]/favorite/route";
import { GET as getBirthdays } from "@/app/api/people/birthdays/route";
import { GET as getPickers } from "@/app/api/people/pickers/route";
import { ensureDbInitialized } from "@/db";

describe("People REST API Endpoints", () => {
  let createdPersonId = "";
  let createdPersonSlug = "";

  beforeAll(async () => {
    await ensureDbInitialized();
  });

  it("creates a new person via POST /api/people", async () => {
    const request = new Request("http://localhost/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "API Test Person",
        nickname: "Tester",
        relationshipType: "Colleague",
        notesMarkdown: "Notes for API test",
        interests: "coding, testing",
        importantDates: [
          {
            title: "Birthday",
            date: "2000-05-15",
            reminderEnabled: true,
          },
        ],
        visibility: "private",
        favorite: 1,
      }),
    });

    const response = await createOrUpdatePerson(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.person).toBeDefined();
    expect(data.person.displayName).toBe("API Test Person");
    expect(data.person.relationshipType).toBe("Colleague");

    createdPersonId = data.person.id;
    createdPersonSlug = data.person.slug;
  });

  it("lists people via GET /api/people with search and pagination", async () => {
    const request = new Request("http://localhost/api/people?search=API+Test&page=1&limit=10");
    const response = await getPeopleList(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.people).toBeInstanceOf(Array);
    expect(data.people.length).toBeGreaterThanOrEqual(1);
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data.page).toBe(1);
    expect(data.people.some((p: any) => p.id === createdPersonId)).toBe(true);
  });

  it("fetches single person Memory Hub data via GET /api/people/[id]", async () => {
    const request = new Request(`http://localhost/api/people/${createdPersonId}`);
    const response = await getPersonDetail(request, { params: Promise.resolve({ id: createdPersonId }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.person).toBeDefined();
    expect(data.person.id).toBe(createdPersonId);
    expect(data.connections).toBeDefined();
    expect(data.timeline).toBeInstanceOf(Array);
  });

  it("toggles favorite via POST /api/people/[id]/favorite", async () => {
    const request = new Request(`http://localhost/api/people/${createdPersonId}/favorite`, {
      method: "POST",
    });
    const response = await toggleFavorite(request, { params: Promise.resolve({ id: createdPersonId }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    // Was 1, toggled to false (0)
    expect(data.favorite).toBe(false);
  });

  it("updates person via PUT /api/people/[id]", async () => {
    const request = new Request(`http://localhost/api/people/${createdPersonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "API Test Person Updated",
        nickname: "ProTester",
      }),
    });

    const response = await updatePerson(request, { params: Promise.resolve({ id: createdPersonId }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.person.displayName).toBe("API Test Person Updated");
    expect(data.person.nickname).toBe("ProTester");
  });

  it("fetches upcoming birthdays via GET /api/people/birthdays", async () => {
    const request = new Request("http://localhost/api/people/birthdays?limit=10");
    const response = await getBirthdays(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.upcoming).toBeInstanceOf(Array);
  });

  it("fetches pickers data via GET /api/people/pickers", async () => {
    const response = await getPickers();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.locations).toBeInstanceOf(Array);
    expect(data.trips).toBeInstanceOf(Array);
    expect(data.projects).toBeInstanceOf(Array);
    expect(data.microblogs).toBeInstanceOf(Array);
    expect(data.photos).toBeInstanceOf(Array);
    expect(data.collections).toBeInstanceOf(Array);
  });

  it("deletes person via DELETE /api/people/[id]", async () => {
    const request = new Request(`http://localhost/api/people/${createdPersonId}`, {
      method: "DELETE",
    });
    const response = await deletePerson(request, { params: Promise.resolve({ id: createdPersonId }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify deletion
    const verifyReq = new Request(`http://localhost/api/people/${createdPersonId}`);
    const verifyRes = await getPersonDetail(verifyReq, { params: Promise.resolve({ id: createdPersonId }) });
    expect(verifyRes.status).toBe(404);
  });
});
