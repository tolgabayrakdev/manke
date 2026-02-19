import { withTransaction } from "../database.js";
import * as usersRepo from "../repository/users.js";
import { NotFoundError, ValidationError } from "../errors/appError.js";
import { emailQueue, auditQueue, reportQueue } from "../jobs/queues.js";

export async function getAllUsers() {
  return usersRepo.findAll();
}

export async function getUserById(id) {
  const user = await usersRepo.findById(id);
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function createUser({ name, email }) {
  if (!name || !email) throw new ValidationError("name and email are required");

  const user = await withTransaction((client) => usersRepo.insert({ name, email }, client));
  await emailQueue.add("welcome", { name: user.name, email: user.email, type: "welcome" });
  await auditQueue.add("log", { action: "create", userId: user.id, payload: { name, email }, performedAt: new Date().toISOString() });
  return user;
}

export async function updateUser(id, { name, email }) {
  if (!name || !email) throw new ValidationError("name and email are required");

  const user = await withTransaction(async (client) => {
    const updated = await usersRepo.update(id, { name, email }, client);
    if (!updated) throw new NotFoundError("User not found");
    return updated;
  });
  await auditQueue.add("log", { action: "update", userId: id, payload: { name, email }, performedAt: new Date().toISOString() });
  return user;
}

export async function deleteUser(id) {
  const deleted = await usersRepo.remove(id);
  if (!deleted) throw new NotFoundError("User not found");
  await auditQueue.add("log", { action: "delete", userId: id, payload: null, performedAt: new Date().toISOString() });
  await reportQueue.add("deletion-report", { userId: id, deletedAt: new Date().toISOString() });
}
