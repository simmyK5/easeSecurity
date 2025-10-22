const Developer = require('../Model/Developer');

async function useQuota(devId) {
  const dev = await Developer.findById(devId);
  if (!dev) throw new Error('Developer not found');
  if (dev.quota.freeCallsRemaining <= 0) return false;
  dev.quota.freeCallsRemaining -= 1;
  dev.quota.totalCalls += 1;
  await dev.save();
  return true;
}

module.exports = { useQuota };
