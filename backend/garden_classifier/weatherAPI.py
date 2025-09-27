import json
from geopy.geocoders import Nominatim
from datetime import datetime, timezone, timedelta
import openmeteo_requests
import requests_cache
from retry_requests import retry
from astral import LocationInfo
from astral.sun import sun

# Computes summary features for the previous week from hourly weather data
def compute_prev_week_features(hourly):
    times = hourly["time"]
    temps = hourly["temperature_2m"]
    precs = hourly["precipitation"]
    ws    = hourly.get("windspeed_10m", [])

    # Aggregate hourly data into daily buckets
    daily = {}
    for i, ts in enumerate(times):
        day = ts[:10]
        d = daily.setdefault(day, {"temps": [], "precs": [], "winds": []})
        d["temps"].append(temps[i])
        d["precs"].append(precs[i])
        if ws: d["winds"].append(ws[i])

    # Get previous 7 days (excluding today)
    today = datetime.now(timezone.utc).date()
    prev_days = [d for d in sorted(daily.keys()) if datetime.fromisoformat(d).date() < today]
    prev7 = prev_days[-7:]

    if not prev7:
        return None

    # Calculate summary statistics
    tmaxes, tmins = [], []
    total_rain = 0.0
    windy_days = 0
    for d in prev7:
        tmaxes.append(max(daily[d]["temps"]))
        tmins.append(min(daily[d]["temps"]))
        total_rain += sum(daily[d]["precs"])
        if ws and daily[d]["winds"]:
            if max(daily[d]["winds"]) >= 35:
                windy_days += 1

    return {
        "total_rain_mm": round(total_rain, 1),
        "avg_tmax_c": round(sum(tmaxes) / len(tmaxes), 1),
        "avg_tmin_c": round(sum(tmins) / len(tmins), 1),
        "windy_days": windy_days
    }

# Geocodes a location name to latitude and longitude using Nominatim
def get_coordinates(location_name):
    geolocator = Nominatim(user_agent="weather_app")
    location = geolocator.geocode(location_name, timeout=10)
    if not location:
        raise ValueError(f"Location '{location_name}' not found")
    return location.latitude, location.longitude

# Summarizes the next week's forecast from hourly data
def summarize_next_week(data):
    times = data["hourly"]["time"]
    temps = data["hourly"]["temperature_2m"]
    precs = data["hourly"]["precipitation"]
    ws = data["hourly"].get("windspeed_10m", [])
    uvi = data["hourly"].get("uv_index", [])

    # Aggregate hourly data into daily buckets
    daily = {}
    for i, ts in enumerate(times):
        day = ts[:10]
        d = daily.setdefault(day, {"temps": [], "precs": [], "winds": [], "uvis": []})
        d["temps"].append(temps[i])
        d["precs"].append(precs[i])
        if ws: d["winds"].append(ws[i])
        if uvi: d["uvis"].append(uvi[i])

    # Build daily summaries for the next 7 days
    today_ymd = datetime.now(timezone.utc).date().isoformat()
    out = []
    for day in sorted(daily.keys()):
        if day < today_ymd:
            continue
        v = daily[day]
        tmin = min(v["temps"])
        tmax = max(v["temps"])
        rain = sum(v["precs"])
        rec = {
            "date": day,
            "t_min_c": round(tmin, 1),
            "t_max_c": round(tmax, 1),
            "rain_mm": round(rain, 1)
        }
        if v["winds"]:
            rec["max_wind_kph"] = round(max(v["winds"]), 1)
        if v["uvis"]:
            rec["uv_index_max"] = round(max(v["uvis"]), 1)
        out.append(rec)
    return out[:7]

# Fetches weather forecast data from Open-Meteo API for given coordinates
def get_weather_forecast(lat, lon):
    cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
    retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
    openmeteo = openmeteo_requests.Client(session=retry_session)

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": float(lat),
        "longitude": float(lon),
        "hourly": ["temperature_2m", "precipitation", "windspeed_10m", "uv_index"],
        "timezone": "auto",
        "forecast_days": 7,
        "past_days": 7
    }

    responses = openmeteo.weather_api(url, params=params)
    response = responses[0]

    tz = response.Timezone() or "UTC"
    timezone_str = str(tz, 'utf-8') if isinstance(tz, bytes) else tz

    # Build hourly arrays manually from API response
    t0 = response.Hourly().Time()
    t1 = response.Hourly().TimeEnd()
    step = response.Hourly().Interval()
    times = []
    t = t0
    while t < t1:
        times.append(datetime.fromtimestamp(t, tz=timezone.utc).isoformat())
        t += step

    hourly = response.Hourly()
    out_hourly = {
        "time": times,
        "temperature_2m": hourly.Variables(0).ValuesAsNumpy().tolist(),
        "precipitation":  hourly.Variables(1).ValuesAsNumpy().tolist(),
        "windspeed_10m":  hourly.Variables(2).ValuesAsNumpy().tolist(),
        "uv_index":       hourly.Variables(3).ValuesAsNumpy().tolist()
    }

    # Calculate sun position data for the next days
    sun_data = calculate_sun_position(float(lat), float(lon), timezone_str, 6)

    return {
        "coordinates": {
            "latitude": response.Latitude(),
            "longitude": response.Longitude(),
            "elevation": response.Elevation(),
            "timezone": timezone_str,
            "timezone_abbreviation": response.TimezoneAbbreviation(),
            "utc_offset_seconds": response.UtcOffsetSeconds()
        },
        "hourly": out_hourly,
        "daily": sun_data
    }

# Calculates sun position and daylight info for a location for several days
def calculate_sun_position(lat, lon, timezone_str, days=6):
    import pytz
    sun_data = []
    try:
        timezone_obj = pytz.timezone(timezone_str)
    except Exception:
        timezone_obj = pytz.UTC
    location = LocationInfo(
        name="CustomLocation",
        region="Region",
        timezone=timezone_str,
        latitude=lat,
        longitude=lon
    )
    current_date = datetime.now().date()
    for i in range(days):
        date = current_date + timedelta(days=i)
        try:
            s = sun(location.observer, date=date)
            utc = pytz.UTC
            local_sunrise = s["sunrise"].replace(tzinfo=utc).astimezone(timezone_obj)
            local_sunset  = s["sunset"].replace(tzinfo=utc).astimezone(timezone_obj)
            local_noon    = s["noon"].replace(tzinfo=utc).astimezone(timezone_obj)
            daylight_seconds = (local_sunset - local_sunrise).total_seconds()
            daylight_hours = int(daylight_seconds // 3600)
            daylight_minutes = int((daylight_seconds % 3600) // 60)
            sunshine_seconds = daylight_seconds * 0.7
            sunshine_hours = int(sunshine_seconds // 3600)
            sunshine_minutes = int((sunshine_seconds % 3600) // 60)
            from astral.sun import elevation, azimuth
            noon_elevation = elevation(observer=location.observer, dateandtime=s["noon"])
            noon_azimuth = azimuth(observer=location.observer, dateandtime=s["noon"])
            sun_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "sunrise": local_sunrise.strftime("%H:%M:%S"),
                "sunset": local_sunset.strftime("%H:%M:%S"),
                "solar_noon": local_noon.strftime("%H:%M:%S"),
                "daylight_duration": f"{daylight_hours}h {daylight_minutes}m",
                "sunshine_duration": f"{sunshine_hours}h {sunshine_minutes}m",
                "solar_elevation_noon": f"{noon_elevation:.1f}°",
                "solar_azimuth_noon": f"{noon_azimuth:.1f}°"
            })
        except Exception:
            sun_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "sunrise": None,
                "sunset": None,
                "solar_noon": None,
                "daylight_duration": None,
                "sunshine_duration": None,
                "solar_elevation_noon": None,
                "solar_azimuth_noon": None
            })
    return sun_data

# Summarizes hourly forecast data into daily averages and totals
def summarize_forecast(data):
    time_list = data["hourly"]["time"]
    temps = data["hourly"]["temperature_2m"]
    precs = data["hourly"]["precipitation"]

    daily_summary = {}
    for i, timestamp in enumerate(time_list):
        dt = datetime.fromisoformat(timestamp)
        day = dt.date().isoformat()
        d = daily_summary.setdefault(day, {"temps": [], "precs": []})
        d["temps"].append(temps[i])
        d["precs"].append(precs[i])

    summarized = []
    for day, v in daily_summary.items():
        avg_temp = sum(v["temps"]) / len(v["temps"])
        total_prec = sum(v["precs"])
        summarized.append({
            "date": day,
            "avg_temperature": avg_temp,
            "total_precipitation": total_prec
        })
    return summarized

# Recursively converts bytes objects to strings in nested data structures
def convert_bytes(obj):
    if isinstance(obj, bytes):
        try:
            return obj.decode("utf-8")
        except Exception:
            return str(obj)
    if isinstance(obj, dict):
        return {k: convert_bytes(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_bytes(v) for v in obj]
    return obj

# Main entry point: gets weather data for a location and returns a JSON summary
def start(location_name, flag):
    if flag != 0:
        lat, lon = get_coordinates(location_name)
    else:
        lat, lon = location_name.split(",")
    forecast_data = get_weather_forecast(lat, lon)
    summarized = summarize_forecast(forecast_data)
    weekly_outlook = summarize_next_week(forecast_data)
    prev_week_features = compute_prev_week_features(forecast_data["hourly"])

    output = {
        "coordinates": forecast_data["coordinates"],
        "hourly": forecast_data["hourly"],
        "daily_sun_data": forecast_data["daily"],
        "daily_summary": summarized,
        "weekly_outlook": weekly_outlook,
        "prev_week_features": prev_week_features
    }
    safe_output = convert_bytes(output)
    return json.dumps(safe_output, indent=4)
