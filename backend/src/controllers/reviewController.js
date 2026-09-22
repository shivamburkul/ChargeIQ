
const { Review, Station, Booking } = require('../models');

async function recalcStationRating(stationId) {
  const reviews = await Review.findAll({ where: { stationId } });
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  await Station.update({ ratingAvg: Number(avg.toFixed(2)), ratingCount: count }, { where: { id: stationId } });
}

exports.addReview = async (req, res) => {
  try {
    const { stationId, rating, comment, bookingId } = req.body;
    if (!stationId || !rating || !bookingId) {
      return res.status(400).json({ message: 'stationId, rating and bookingId are required. You can only rate a station after completing a charging session there.' });
    }

    const booking = await Booking.findOne({ where: { id: Number(bookingId), userId: req.user.id, stationId: Number(stationId), status: 'completed' } });
    if (!booking) {
      return res.status(400).json({ message: 'You can only review a station after completing a charging session there.' });
    }

    const existing = await Review.findOne({ where: { bookingId: Number(bookingId) } });
    if (existing) {
      return res.status(409).json({ message: 'You have already rated this charging session.' });
    }

    const review = await Review.create({ userId: req.user.id, stationId: Number(stationId), rating, comment: comment || null, bookingId: Number(bookingId) });
    await recalcStationRating(Number(stationId));

    res.status(201).json({ review });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add review.', error: err.message });
  }
};

exports.listStationReviews = async (req, res) => {
  const reviews = await Review.findAll({ where: { stationId: Number(req.params.stationId) }, order: [['createdAt', 'DESC']] });
  res.json({ reviews });
};

exports.deleteReview = async (req, res) => {
  const review = await Review.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!review) return res.status(404).json({ message: 'Review not found.' });
  const { stationId } = review;
  await review.destroy();
  await recalcStationRating(stationId);
  res.json({ message: 'Review deleted.' });
};


