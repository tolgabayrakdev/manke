import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../src/repository/users.js");
vi.mock("../../src/database.js", () => ({
  default: {},
  withTransaction: vi.fn((fn) => fn({})),
}));
vi.mock("../../src/jobs/queues.js", () => ({
  emailQueue: { add: vi.fn().mockResolvedValue({ id: "job-1" }) },
  auditQueue: { add: vi.fn().mockResolvedValue({ id: "job-2" }) },
  reportQueue: { add: vi.fn().mockResolvedValue({ id: "job-3" }) },
}));

import * as usersRepo from "../../src/repository/users.js";
import { withTransaction } from "../../src/database.js";
import { emailQueue, auditQueue, reportQueue } from "../../src/jobs/queues.js";
import * as usersService from "../../src/service/users.js";
import { NotFoundError, ValidationError } from "../../src/errors/appError.js";

const mockUser = { id: 1, name: "Alice", email: "alice@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  withTransaction.mockImplementation((fn) => fn({}));
});

// ─── getAllUsers ────────────────────────────────────────────────────────────

describe("getAllUsers", () => {
  it("returns all users from repository", async () => {
    usersRepo.findAll.mockResolvedValue([mockUser]);

    const result = await usersService.getAllUsers();

    expect(result).toEqual([mockUser]);
    expect(usersRepo.findAll).toHaveBeenCalledOnce();
  });
});

// ─── getUserById ────────────────────────────────────────────────────────────

describe("getUserById", () => {
  it("returns the user when found", async () => {
    usersRepo.findById.mockResolvedValue(mockUser);

    const result = await usersService.getUserById(1);

    expect(result).toEqual(mockUser);
    expect(usersRepo.findById).toHaveBeenCalledWith(1);
  });

  it("throws NotFoundError when user does not exist", async () => {
    usersRepo.findById.mockResolvedValue(null);

    await expect(usersService.getUserById(99)).rejects.toThrow(NotFoundError);
    await expect(usersService.getUserById(99)).rejects.toThrow("User not found");
  });
});

// ─── createUser ────────────────────────────────────────────────────────────

describe("createUser", () => {
  it("inserts user inside a transaction and returns it", async () => {
    usersRepo.insert.mockResolvedValue(mockUser);

    const result = await usersService.createUser({ name: "Alice", email: "alice@example.com" });

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(usersRepo.insert).toHaveBeenCalledWith(
      { name: "Alice", email: "alice@example.com" },
      {}
    );
    expect(result).toEqual(mockUser);
  });

  it("enqueues a welcome email job after creation", async () => {
    usersRepo.insert.mockResolvedValue(mockUser);
    await usersService.createUser({ name: "Alice", email: "alice@example.com" });
    expect(emailQueue.add).toHaveBeenCalledWith("welcome", {
      name: mockUser.name, email: mockUser.email, type: "welcome",
    });
  });

  it("enqueues an audit log job after creation", async () => {
    usersRepo.insert.mockResolvedValue(mockUser);
    await usersService.createUser({ name: "Alice", email: "alice@example.com" });
    expect(auditQueue.add).toHaveBeenCalledWith("log", expect.objectContaining({
      action: "create",
      userId: mockUser.id,
      payload: { name: "Alice", email: "alice@example.com" },
    }));
  });

  it("throws ValidationError when name is missing", async () => {
    await expect(
      usersService.createUser({ email: "alice@example.com" })
    ).rejects.toThrow(ValidationError);

    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("throws ValidationError when email is missing", async () => {
    await expect(
      usersService.createUser({ name: "Alice" })
    ).rejects.toThrow(ValidationError);

    expect(withTransaction).not.toHaveBeenCalled();
  });
});

// ─── updateUser ────────────────────────────────────────────────────────────

describe("updateUser", () => {
  it("updates user inside a transaction and returns it", async () => {
    const updated = { ...mockUser, name: "Bob" };
    usersRepo.update.mockResolvedValue(updated);

    const result = await usersService.updateUser(1, { name: "Bob", email: "alice@example.com" });

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(usersRepo.update).toHaveBeenCalledWith(
      1,
      { name: "Bob", email: "alice@example.com" },
      {}
    );
    expect(result).toEqual(updated);
  });

  it("throws NotFoundError when user does not exist", async () => {
    usersRepo.update.mockResolvedValue(null);

    await expect(
      usersService.updateUser(99, { name: "Bob", email: "bob@example.com" })
    ).rejects.toThrow(NotFoundError);
  });

  it("enqueues an audit log job after update", async () => {
    const updated = { ...mockUser, name: "Bob" };
    usersRepo.update.mockResolvedValue(updated);
    await usersService.updateUser(1, { name: "Bob", email: "alice@example.com" });
    expect(auditQueue.add).toHaveBeenCalledWith("log", expect.objectContaining({
      action: "update",
      userId: 1,
      payload: { name: "Bob", email: "alice@example.com" },
    }));
  });

  it("throws ValidationError when name is missing", async () => {
    await expect(
      usersService.updateUser(1, { email: "alice@example.com" })
    ).rejects.toThrow(ValidationError);

    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("throws ValidationError when email is missing", async () => {
    await expect(
      usersService.updateUser(1, { name: "Alice" })
    ).rejects.toThrow(ValidationError);

    expect(withTransaction).not.toHaveBeenCalled();
  });
});

// ─── deleteUser ────────────────────────────────────────────────────────────

describe("deleteUser", () => {
  it("deletes user successfully", async () => {
    usersRepo.remove.mockResolvedValue(true);

    await expect(usersService.deleteUser(1)).resolves.toBeUndefined();
    expect(usersRepo.remove).toHaveBeenCalledWith(1);
  });

  it("throws NotFoundError when user does not exist", async () => {
    usersRepo.remove.mockResolvedValue(false);

    await expect(usersService.deleteUser(99)).rejects.toThrow(NotFoundError);
  });

  it("enqueues audit and report jobs after deletion", async () => {
    usersRepo.remove.mockResolvedValue(true);
    await usersService.deleteUser(1);
    expect(auditQueue.add).toHaveBeenCalledWith("log", expect.objectContaining({
      action: "delete",
      userId: 1,
      payload: null,
    }));
    expect(reportQueue.add).toHaveBeenCalledWith("deletion-report", expect.objectContaining({
      userId: 1,
    }));
  });
});
