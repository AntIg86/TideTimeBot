import { describe, expect, it } from 'vitest';
import { destination, distanceKm, ringPoints } from '../src/domain/geo';

const murmansk = { lat: 68.9707, lon: 33.0749 };

describe('geo', () => {
  it('measures great-circle distances', () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.2, 1);
    expect(distanceKm(murmansk, murmansk)).toBe(0);
  });

  it('moves the requested distance along a bearing', () => {
    for (const bearing of [0, 45, 90, 200]) {
      expect(distanceKm(murmansk, destination(murmansk, 40, bearing))).toBeCloseTo(40, 6);
    }
    expect(destination({ lat: 0, lon: 0 }, 111.2, 0).lat).toBeCloseTo(1, 2);
  });

  it('wraps longitude across the antimeridian', () => {
    expect(destination({ lat: 0, lon: 179.9 }, 50, 90).lon).toBeLessThan(-179);
  });

  it('builds rings of evenly spaced points', () => {
    const points = ringPoints(murmansk, [{ km: 20, count: 8 }, { km: 60, count: 16 }]);
    expect(points).toHaveLength(24);
    expect(distanceKm(murmansk, points[0])).toBeCloseTo(20, 6);
    expect(distanceKm(murmansk, points[23])).toBeCloseTo(60, 6);
  });
});
