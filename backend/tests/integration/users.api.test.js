import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../src/service/users.js");

import request from "supertest";
import app from "../../src/app.js";
import * as usersService from "../../src/service/users.js";
import { NotFoundError, ValidationError } from "../../src/errors/appError.js";

const mockUser = { id: 1, name: "Alice", email: "alice@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/users ─────────────────────────────────────────────────────────

describe("GET /api/users", () => {
  it("returns 200 with list of users", async () => {
    usersService.getAllUsers.mockResolvedValue([mockUser]);

    const res = await request(app).get("/api/users");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([mockUser]);
  });
});

// ─── GET /api/users/:id ─────────────────────────────────────────────────────

describe("GET /api/users/:id", () => {
  it("returns 200 with user when found", async () => {
    usersService.getUserById.mockResolvedValue(mockUser);

    const res = await request(app).get("/api/users/1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockUser);
  });

  it("returns 404 when user not found", async () => {
    usersService.getUserById.mockRejectedValue(new NotFoundError("User not found"));

    const res = await request(app).get("/api/users/99");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "User not found" });
  });
});

// ─── POST /api/users ─────────────────────────────────────────────────────────

describe("POST /api/users", () => {
  it("returns 201 with created user", async () => {
    usersService.createUser.mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/users")
      .send({ name: "Alice", email: "alice@example.com" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(mockUser);
  });

  it("returns 400 when validation fails", async () => {
    usersService.createUser.mockRejectedValue(
      new ValidationError("name and email are required")
    );

    const res = await request(app).post("/api/users").send({ name: "Alice" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "name and email are required" });
  });
});

// ─── PUT /api/users/:id ──────────────────────────────────────────────────────

describe("PUT /api/users/:id", () => {
  it("returns 200 with updated user", async () => {
    const updated = { ...mockUser, name: "Bob" };
    usersService.updateUser.mockResolvedValue(updated);

    const res = await request(app)
      .put("/api/users/1")
      .send({ name: "Bob", email: "alice@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
  });

  it("returns 404 when user not found", async () => {
    usersService.updateUser.mockRejectedValue(new NotFoundError("User not found"));

    const res = await request(app)
      .put("/api/users/99")
      .send({ name: "Bob", email: "bob@example.com" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "User not found" });
  });

  it("returns 400 when validation fails", async () => {
    usersService.updateUser.mockRejectedValue(
      new ValidationError("name and email are required")
    );

    const res = await request(app).put("/api/users/1").send({ name: "Bob" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "name and email are required" });
  });
});

// ─── DELETE /api/users/:id ───────────────────────────────────────────────────

describe("DELETE /api/users/:id", () => {
  it("returns 204 on successful delete", async () => {
    usersService.deleteUser.mockResolvedValue(undefined);

    const res = await request(app).delete("/api/users/1");

    expect(res.status).toBe(204);
  });

  it("returns 404 when user not found", async () => {
    usersService.deleteUser.mockRejectedValue(new NotFoundError("User not found"));

    const res = await request(app).delete("/api/users/99");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "User not found" });
  });
});
