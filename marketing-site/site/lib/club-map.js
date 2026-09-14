import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function createClubMap(element, locations, onTileError) {
  const map = L.map(element, { scrollWheelZoom: false, maxZoom: 16 }).setView([55.2, -3.5], 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  })
    .on('tileerror', onTileError)
    .addTo(map);
  const markers = L.layerGroup().addTo(map);
  let visible = locations;

  function render() {
    markers.clearLayers();
    const groups = new Map();
    for (const club of visible) {
      const point = map.project([club.latitude, club.longitude]);
      const key = `${Math.floor(point.x / 56)},${Math.floor(point.y / 56)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(club);
    }
    for (const group of groups.values()) {
      const lat = group.reduce((sum, club) => sum + club.latitude, 0) / group.length;
      const lng = group.reduce((sum, club) => sum + club.longitude, 0) / group.length;
      const label = group.length === 1 ? group[0].name : `${group.length} clubs in this area`;
      const icon = L.divIcon({
        className: 'club-map-marker',
        html: `<span class="flex h-12 w-12 items-center justify-center rounded-full border-2 border-paper bg-forest font-sans text-sm font-semibold text-paper shadow-lg">${group.length === 1 ? '<span class="h-3 w-3 rounded-full bg-sage"></span>' : group.length}</span>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });
      const marker = L.marker([lat, lng], { icon, title: label, alt: label, keyboard: true }).addTo(
        markers
      );
      const popup = document.createElement('div');
      popup.className = 'max-h-64 space-y-4 overflow-y-auto font-sans';
      for (const club of group) {
        const item = document.createElement('div');
        const link = document.createElement('a');
        link.href = club.path;
        link.textContent = club.name;
        link.className = 'inline-flex min-h-12 items-center text-sm font-semibold underline';
        const detail = document.createElement('p');
        detail.className = 'text-xs leading-5';
        detail.textContent = `${club.town} · ${club.precision === 'postcode' ? 'Approximate postcode location' : 'Approximate town centre'}`;
        item.append(link, detail);
        popup.append(item);
      }
      marker.bindPopup(popup, { maxWidth: 290 });
      if (group.length > 1) {
        marker.on('click', () => {
          const bounds = L.latLngBounds(group.map((club) => [club.latitude, club.longitude]));
          if (map.getZoom() < 12 && !bounds.getNorthEast().equals(bounds.getSouthWest())) {
            map.closePopup();
            map.fitBounds(bounds, {
              animate: false,
              padding: [55, 55],
              maxZoom: Math.min(12, map.getZoom() + 3),
            });
          }
        });
      }
    }
  }
  map.on('zoomend', render);
  return {
    update(slugs) {
      visible = locations.filter((club) => slugs.includes(club.slug));
      map.invalidateSize();
      if (visible.length)
        map.fitBounds(
          visible.map((club) => [club.latitude, club.longitude]),
          { animate: false, padding: [40, 40], maxZoom: 12 }
        );
      else map.setView([55.2, -3.5], 5);
      render();
      return visible.length;
    },
  };
}
