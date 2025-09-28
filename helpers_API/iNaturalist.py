import requests
import os
import time  # To add a delay and avoid rate limits

TAXON_ID = "54919"  # Replace with your flower's taxon ID
SAVE_DIR = "Cucumber"
TOTAL_IMAGES = 200  # Total images needed
IMAGES_PER_PAGE = 100  # Max images per request
PAGES = TOTAL_IMAGES // IMAGES_PER_PAGE  # Number of pages needed

# Create directory
os.makedirs(SAVE_DIR, exist_ok=True)

for page in range(1, PAGES + 1):
    API_URL = f"https://api.inaturalist.org/v1/observations?taxon_id={TAXON_ID}&per_page={IMAGES_PER_PAGE}&page={page}&order_by=random"

    response = requests.get(API_URL).json()

    if "results" not in response or not response["results"]:
        print(f"No more results found at page {page}. Stopping.")
        break  # Stop if the re are no more pages

    # Download images from each observation
    for i, obs in enumerate(response["results"]):
        if "photos" in obs and obs["photos"]:
            img_url = obs["photos"][0]["url"].replace("square", "original")  # Get high-res image
            img_path = f"{SAVE_DIR}/{TAXON_ID}_page{page}_img{i}.jpg"
            
            img_data = requests.get(img_url).content
            with open(img_path, "wb") as f:
                f.write(img_data)
            
            print(f"Downloaded {img_path}")

    print(f"Sleeping for 1 minute before the next request... 💤")
    time.sleep(60)  # Sleep for 60 seconds

print("✅ Download completed!")
