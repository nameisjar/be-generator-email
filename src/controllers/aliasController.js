// HTTP layer for aliases.
const aliasService = require('../services/aliasService');

async function list(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const activeOnly = req.query.active === 'true';
  const data = await aliasService.listAliases(req.user.id, {
    page,
    pageSize,
    search,
    activeOnly,
  });
  res.json(data);
}

async function create(req, res) {
  const alias = await aliasService.createAlias(req.user.id, req.body);
  res.status(201).json({ alias });
}

async function update(req, res) {
  const alias = await aliasService.updateAlias(req.user.id, req.params.id, req.body);
  res.json({ alias });
}

async function remove(req, res) {
  await aliasService.deleteAlias(req.user.id, req.params.id);
  res.status(204).end();
}

async function getOne(req, res) {
  const alias = await aliasService.getAliasForUser(req.user.id, req.params.id);
  res.json({ alias });
}

module.exports = { list, create, update, remove, getOne };
