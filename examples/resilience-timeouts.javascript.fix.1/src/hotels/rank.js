export function rankOffers(offers, query) {
  const nights = query.nights ?? 1;
  const best = new Map();
  for (const offer of offers) {
    const current = best.get(offer.hotelId);
    if (!current || offer.pricePerNight < current.pricePerNight) best.set(offer.hotelId, offer);
  }
  return [...best.values()]
    .map((offer) => ({ ...offer, total: offer.pricePerNight * nights }))
    .sort((a, b) => a.total - b.total || a.hotelId.localeCompare(b.hotelId));
}
