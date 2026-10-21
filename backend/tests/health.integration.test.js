
const request = require("supertest");
const app = require("../src/app");

describe("Health API integration", () => {
  it("should expose the health endpoint", async () => {
    const response = await request(app).get("/api/health");

    expect([200, 503]).toContain(response.status);
    expect(response.headers["content-type"]).toMatch(/json/);
  });

  it("should return a JSON response for an unknown API route", async () => {
    const response = await request(app).get("/api/route-that-does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/json/);
  });
});
