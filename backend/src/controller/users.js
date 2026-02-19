import * as usersService from "../service/users.js";

export async function getUsers(req, res) {
  const users = await usersService.getAllUsers();
  res.json(users);
}

export async function getUser(req, res) {
  const user = await usersService.getUserById(req.params.id);
  res.json(user);
}

export async function createUser(req, res) {
  const user = await usersService.createUser(req.body);
  res.status(201).json(user);
}

export async function updateUser(req, res) {
  const user = await usersService.updateUser(req.params.id, req.body);
  res.json(user);
}

export async function deleteUser(req, res) {
  await usersService.deleteUser(req.params.id);
  res.status(204).send();
}
