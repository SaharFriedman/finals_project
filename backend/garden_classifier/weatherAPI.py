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

def get_coordinates(location_name):
    geolocator = Nominatim(user_agent="weather_app")
    location = geolocator.geocode(location_name, timeout=10)
    if not location:
        raise ValueError(f"Location '{location_name}' not found")
    return location.latitude, location.longitude

def get_weather_forecast(lat, lon):
    cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
    retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
    openmeteo = openmeteo_requests.Client(session=retry_session)

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ["temperature_2m", "precipitation"],
        "timezone": "auto",
        "forecast_days": 6
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
            "precipitation": hourly_dataframe["precipitation"].tolist()
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
    output = {
        "coordinates": forecast_data["coordinates"],
        "hourly": forecast_data["hourly"],
        "daily_sun_data": forecast_data["daily"],
        "daily_summary": summarized
    }

    safe_output = convert_bytes(output)
    json_output = json.dumps(safe_output, indent=4)
    return json_output