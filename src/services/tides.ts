import axios from 'axios';
import { isSameDay, parseISO, addSeconds } from 'date-fns';

interface TideData {
  highTides: string[];
  lowTides: string[];
  status: string;
  nextTide: { type: string; time: string } | null;
  timezone: string;
  maxWaveHeight: number | null;
  maxWindSpeed: number | null;
  sunrise: string | null;
  sunset: string | null;
}

interface TideEvent {
  time: Date;
  localTimeStr: string; // Store the "YYYY-MM-DDTHH:mm" local string
  type: 'high' | 'low';
}

function formatOffset(seconds: number) {
    const sign = seconds >= 0 ? '+' : '-';
    const abs = Math.abs(seconds);
    const hours = Math.floor(abs / 3600);
    const mins = Math.floor((abs % 3600) / 60);
    return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Finds local maxima (high tides) and minima (low tides) in hourly data.
 * @param times List of ISO time strings
 * @param heights List of sea level heights
 * @param utcOffsetSeconds Timezone offset in seconds
 * @returns Array of TideEvent
 */
function findHighLowTides(times: string[], heights: number[], utcOffsetSeconds: number): TideEvent[] {
  const events: TideEvent[] = [];
  
  // Need at least 3 points to find a peak/trough
  if (times.length < 3 || heights.length < 3) return events;

  for (let i = 1; i < heights.length - 1; i++) {
    const prev = heights[i - 1];
    const curr = heights[i];
    const next = heights[i + 1];

    const timeStr = times[i];
    // Create Date object adjusted for offset
    const offsetString = formatOffset(utcOffsetSeconds);
    const date = new Date(`${timeStr}${offsetString}`);

    if (curr > prev && curr >= next) {
        events.push({ time: date, localTimeStr: timeStr, type: 'high' });
    } else if (curr < prev && curr <= next) { // Trough
        if (curr < prev && curr < next) {
             events.push({ time: date, localTimeStr: timeStr, type: 'low' });
        }
    }
  }
  
  return events;
}

export async function getTides(lat: number, lon: number): Promise<TideData> {
  try {
    // Parallel calls to Marine and Forecast APIs
    const [marineResponse, forecastResponse] = await Promise.all([
      axios.get('https://marine-api.open-meteo.com/v1/marine', {
        params: {
          latitude: lat,
          longitude: lon,
          hourly: 'sea_level_height_msl', 
          daily: 'wave_height_max', 
          timezone: 'auto',
          past_days: 1, 
          forecast_days: 2, 
        },
      }),
      axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
          daily: 'wind_speed_10m_max,sunrise,sunset',
          wind_speed_unit: 'ms',
          timezone: 'auto',
          past_days: 1,
          forecast_days: 2,
        }
      })
    ]);

    const marineData = marineResponse.data;
    const forecastData = forecastResponse.data;

    const hourly = marineData.hourly;
    const dailyMarine = marineData.daily; 
    const dailyForecast = forecastData.daily;
    const timezone = marineData.timezone;
    const utcOffset = marineData.utc_offset_seconds;

    const times: string[] = hourly.time;
    const heights: number[] = hourly.sea_level_height_msl;

    // 1. Find all events in the fetched period
    const allEvents = findHighLowTides(times, heights, utcOffset);

    // 2. Filter for "Today" (Local Time)
    const nowUTC = new Date();
    const nowLocalTimestamp = nowUTC.getTime() + (utcOffset * 1000);
    const nowLocal = new Date(nowLocalTimestamp);
    
    // Calculate "Today" string based on the current time in that timezone.
    const todayStr = nowLocal.toISOString().substring(0, 10); // "YYYY-MM-DD"
    
    // Filter events where the local time string matches today's date
    const todayEvents = allEvents.filter(e => e.localTimeStr.startsWith(todayStr));

    // Get Daily Data for Today (Merge from Marine and Forecast)
    let maxWaveHeight: number | null = null;
    let maxWindSpeed: number | null = null;
    let sunrise: string | null = null;
    let sunset: string | null = null;

    // Marine Data (Waves)
    if (dailyMarine && dailyMarine.time) {
        const index = dailyMarine.time.indexOf(todayStr);
        if (index !== -1) {
            maxWaveHeight = dailyMarine.wave_height_max ? dailyMarine.wave_height_max[index] : null;
        }
    }

    // Forecast Data (Wind, Sun)
    if (dailyForecast && dailyForecast.time) {
        const index = dailyForecast.time.indexOf(todayStr);
        if (index !== -1) {
             maxWindSpeed = dailyForecast.wind_speed_10m_max ? dailyForecast.wind_speed_10m_max[index] : null;
             sunrise = dailyForecast.sunrise ? dailyForecast.sunrise[index] : null;
             sunset = dailyForecast.sunset ? dailyForecast.sunset[index] : null;
        }
    }

    // 3. Determine Next Tide (Future relative to Now)
    const futureEvents = allEvents.filter(e => e.time.getTime() > nowUTC.getTime());
    const nextTideEvent = futureEvents.length > 0 ? futureEvents[0] : null;

    const nextTide = nextTideEvent ? {
        type: nextTideEvent.type,
        time: nextTideEvent.localTimeStr
    } : null;

    // 4. Determine Current Status
    let currentIndex = 0;
    let minDiff = Infinity;
    
    for(let i=0; i<times.length; i++) {
        const tDate = new Date(times[i] + "Z"); 
        const nDate = new Date(nowLocal.toISOString().replace('Z', '') + "Z"); 
        
        const diff = Math.abs(tDate.getTime() - nDate.getTime());
        if (diff < minDiff) {
            minDiff = diff;
            currentIndex = i;
        }
    }
    
    let status = 'Unknown 🤷';
    if (currentIndex < heights.length - 1) {
        if (heights[currentIndex + 1] > heights[currentIndex]) {
            status = 'Rising 🌊';
        } else {
            status = 'Falling 🏖️';
        }
    }

    const highTidesStr = todayEvents.filter(e => e.type === 'high').map(e => e.localTimeStr);
    const lowTidesStr = todayEvents.filter(e => e.type === 'low').map(e => e.localTimeStr);

    return {
      highTides: highTidesStr,
      lowTides: lowTidesStr,
      status: status,
      nextTide: nextTide,
      timezone: timezone,
      maxWaveHeight: maxWaveHeight,
      maxWindSpeed: maxWindSpeed,
      sunrise: sunrise,
      sunset: sunset,
    };

  } catch (error: any) {
    if (axios.isAxiosError(error)) {
        if (error.response?.data) {
             console.error('Open-Meteo API Error Response:', JSON.stringify(error.response.data, null, 2));
        }
        throw new Error(`Tide API error: ${error.message}`);
    }
    throw error;
  }
}