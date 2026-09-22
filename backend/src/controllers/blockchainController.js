
const blockchainService = require('../services/blockchainService');
const { Booking } = require('../models');

exports.getChain = async (req, res) => {
  const chain = await blockchainService.getChain();
  res.json({ length: chain.length, chain });
};

exports.verifyChain = async (req, res) => {
  const result = await blockchainService.verifyChain();
  res.json(result);
};

exports.getBlocksForBooking = async (req, res) => {
  const booking = await Booking.findOne({ where: { id: Number(req.params.bookingId), userId: req.user.id } });
  if (!booking && req.user.role !== 'admin') return res.status(404).json({ message: 'Booking not found.' });
  const blocks = await blockchainService.findBlocksByBookingId(req.params.bookingId);
  res.json({ blocks });
};
