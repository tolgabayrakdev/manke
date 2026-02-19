import { withTransaction } from "../database.js";
import * as usersRepo from "../repository/users.js";
import { NotFoundError, ValidationError } from "../errors/appError.js";

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

  return withTransaction(async (client) => {
    return usersRepo.insert({ name, email }, client);
  });
}

export async function updateUser(id, { name, email }) {
  if (!name || !email) throw new ValidationError("name and email are required");

  return withTransaction(async (client) => {
    const user = await usersRepo.update(id, { name, email }, client);
    if (!user) throw new NotFoundError("User not found");
    return user;
  });
}

export async function deleteUser(id) {
  const deleted = await usersRepo.remove(id);
  if (!deleted) throw new NotFoundError("User not found");
}
