// HTTP layer for dashboard.
const dashboardService = require('../services/dashboardService');

async function overview(req, res) {
  const data = await dashboardService.getOverview(req.user.id);
  res.json(data);
}

module.exports = { overview };
