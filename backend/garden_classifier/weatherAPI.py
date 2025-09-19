import json
import requests
from geopy.geocoders import Nominatim
from datetime import datetime, timedelta
import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry
from astral import LocationInfo
from astral.sun import sun
from datetime import datetime, timezone, timedelta

def compute_prev_week_features(hourly):
    times = hourly["time"]
    temps = hourly["temperature_2m"]
    precs = hourly["precipitation"]
    ws    = hourly.get("windspeed_10m", [])

    # bucket by day
    daily = {}
    for i, ts in enumerate(times):
        day = ts[:10]
        daily.setdefault(day, {"temps": [], "precs": [], "winds": []})
        daily[day]["temps"].append(temps[i])
        daily[day]["precs"].append(precs[i])
        if ws: daily[day]["winds"].append(ws[i])

    # choose the 7 calendar days strictly before today
    today = datetime.now(timezone.utc).date()
    prev7 = []
    for d in sorted(daily.keys()):
        dd = datetime.fromisoformat(d).date()
        if dd < today:
            prev7.append(d)
    prev7 = prev7[-7:]  # last 7 past days

    if not prev7:
        return None

    tmaxes = []
    tmins  = []
    total_rain = 0.0
    windy_days = 0
    for d in prev7:
        tmaxes.append(max(daily[d]["temps"]))
        tmins.append(min(daily[d]["temps"]))
        total_rain += sum(daily[d]["precs"])
        if ws and daily[d]["winds"]:
            if max(daily[d]["winds"]) >= 35:  # kph threshold
                windy_days += 1

    return {
        "total_rain_mm": round(total_rain, 1),
        "avg_tmax_c": round(sum(tmaxes) / len(tmaxes), 1),
        "avg_tmin_c": round(sum(tmins) / len(tmins), 1),
        "windy_days": windy_days
    }

def get_coordinates(location_name):
    geolocator = Nominatim(user_agent="weather_app")
    location = geolocator.geocode(location_name, timeout=10)
    if not location:
        raise ValueError(f"Location '{location_name}' not found")
    return location.latitude, location.longitude
def summarize_next_week(data):
    times = data["hourly"]["time"]
    temps = data["hourly"]["temperature_2m"]
    precs = data["hourly"]["precipitation"]
    ws = data["hourly"].get("windspeed_10m", [])
    uvi = data["hourly"].get("uv_index", [])

    daily = {}
    for i, ts in enumerate(times):
        day = ts[:10]
        daily.setdefault(day, {"temps": [], "precs": [], "winds": [], "uvis": []})
        daily[day]["temps"].append(temps[i])
        daily[day]["precs"].append(precs[i])
        if ws: daily[day]["winds"].append(ws[i])
        if uvi: daily[day]["uvis"].append(uvi[i])

    today_ymd = datetime.now(timezone.utc).date().isoformat()

    out = []
    for day in sorted(daily.keys()):
      if day < today_ymd:
          continue
      v = daily[day]
      tmin = min(v["temps"])
      tmax = max(v["temps"])
      rain = sum(v["precs"])
      max_wind = max(v["winds"]) if v["winds"] else None
      max_uvi  = max(v["uvis"])  if v["uvis"]  else None
      rec = {
          "date": day,
          "t_min_c": round(tmin, 1),
          "t_max_c": round(tmax, 1),
          "rain_mm": round(rain, 1)
      }
      if max_wind is not None:
          rec["max_wind_kph"] = round(max_wind, 1)
      if max_uvi is not None:
          rec["uv_index_max"] = round(max_uvi, 1)
      out.append(rec)

    return out[:7]
def get_weather_forecast(lat, lon):
    cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
    retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
    openmeteo = openmeteo_requests.Client(session=retry_session)

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
    "latitude": lat,
    "longitude": lon,
    "hourly": ["temperature_2m", "precipitation", "windspeed_10m", "uv_index"],
    "timezone": "auto",
    "forecast_days": 7,
    "past_days": 7
    }


    responses = openmeteo.weather_api(url, params=params)
    response = responses[0]

    timezone_str = None
    if response.Timezone():
        timezone_str = str(response.Timezone(), 'utf-8') if isinstance(response.Timezone(), bytes) else response.Timezone()
    else:
        timezone_str = "UTC"

    hourly = response.Hourly()
    hourly_data = {"time": pd.date_range(
        start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
        end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
        freq=pd.Timedelta(seconds=hourly.Interval()),
        inclusive="left"
    )}
    hourly_data["temperature_2m"] = hourly.Variables(0).ValuesAsNumpy()
    hourly_data["precipitation"] = hourly.Variables(1).ValuesAsNumpy()
    hourly_data["windspeed_10m"] = hourly.Variables(2).ValuesAsNumpy()
    hourly_data["uv_index"] = hourly.Variables(3).ValuesAsNumpy()
    hourly_dataframe = pd.DataFrame(data=hourly_data)

    sun_data = calculate_sun_position(lat, lon, timezone_str, 6)

    result = {
        "coordinates": {
            "latitude": response.Latitude(),
            "longitude": response.Longitude(),
            "elevation": response.Elevation(),
            "timezone": timezone_str,
            "timezone_abbreviation": response.TimezoneAbbreviation(),
            "utc_offset_seconds": response.UtcOffsetSeconds()
        },
        "hourly": {
            "time": hourly_dataframe["time"].astype(str).tolist(),
            "temperature_2m": hourly_dataframe["temperature_2m"].tolist(),
            "precipitation": hourly_dataframe["precipitation"].tolist(),
            "windspeed_10m": hourly_dataframe["windspeed_10m"].tolist(),  # add this
            "uv_index": hourly_dataframe["uv_index"].tolist()              # and this
        },
        "daily": sun_data
    }
    return result

def calculate_sun_position(lat, lon, timezone_str, days=6):
    import pytz
    sun_data = []
    try:
        timezone = pytz.timezone(timezone_str)
    except Exception:
        timezone = pytz.UTC
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
            local_sunrise = s["sunrise"].replace(tzinfo=utc).astimezone(timezone)
            local_sunset = s["sunset"].replace(tzinfo=utc).astimezone(timezone)
            local_noon = s["noon"].replace(tzinfo=utc).astimezone(timezone)
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

def summarize_forecast(data):
    time_list = data["hourly"]["time"]
    temps = data["hourly"]["temperature_2m"]
    precs = data["hourly"]["precipitation"]

    daily_summary = {}
    for i, timestamp in enumerate(time_list):
        dt = datetime.fromisoformat(timestamp)
        day = dt.date().isoformat()
        if day not in daily_summary:
            daily_summary[day] = {"temps": [], "precs": []}
        daily_summary[day]["temps"].append(temps[i])
        daily_summary[day]["precs"].append(precs[i])

    summarized = []
    for day, values in daily_summary.items():
        avg_temp = sum(values["temps"]) / len(values["temps"])
        total_prec = sum(values["precs"])
        summarized.append({
            "date": day,
            "avg_temperature": avg_temp,
            "total_precipitation": total_prec
        })
    return summarized
def convert_bytes(obj):
        if isinstance(obj, bytes):
            try:
                return obj.decode("utf-8")
            except Exception:
                # fallback if bytes are not utf-8, encode as base64 or str
                return str(obj)
        if isinstance(obj, dict):
            return {k: convert_bytes(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [convert_bytes(v) for v in obj]
        return obj

def start(location_name,flag):
    if (flag != 0):
        lat, lon = get_coordinates(location_name)
    else:
        lat,lon = location_name.split(",")
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
    json_output = json.dumps(safe_output, indent=4)
    return json_output