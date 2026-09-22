
const { Notification } = require('../models');

exports.list = async (req, res) => {
  const notifications = await Notification.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']], limit: 50 });
  res.json({ notifications });
};

exports.markRead = async (req, res) => {
  const notif = await Notification.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!notif) return res.status(404).json({ message: 'Notification not found.' });
  notif.isRead = true;
  await notif.save();
  res.json({ notification: notif });
};

exports.markAllRead = async (req, res) => {
  await Notification.update({ isRead: true }, { where: { userId: req.user.id, isRead: false } });
  res.json({ message: 'All notifications marked as read.' });
};


