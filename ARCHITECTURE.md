# Architecture

## Modules / pieces

- Blink Smart Security Cloud
  - Stores clips securely

- Node.JS application
  - Main entry point
  - Orchestrates communication between scripts and APIs
    - Calls python script to download videos
    - Calls AI APIs to identify birds
  - Updates any persistent store

- Python script
  - Uses blinkpy package
  - Authenticates to Blink cloud
  - Downloads clips locally

- AI provider
  - Google Gemini API
  - Receives image with bird(s)
  - Identifies species and returns information


## Node.js logic flow

1. Main entry point
2. Checks authentication status and re-authenticates if needed via Python script
3. Every 10 minutes, check Blink for new clips via Python script
4. If new clips are detected...
   1. Download all new clips locally
   2. Get a screenshot from each new clip
   3. Call AI API to identify bird species in each screenshot
   4. Log clip time and species in JSON file
      1. Filename: date timestamp of the clip
      2. Name of the screenshot
      3. Array of species identified in the screenshot
         1. Whether or not the screenshot has at least one bird in it
         2. Common name of species
         3. Number of the species in the screenshot
         4. Confidence level of identification
5. Wait for the next cycle in the loop


## Python script APIs

### authenticate
- Checks authentication status with Blink
  - If authenticated, return
  - If not authenticated, authenticate using credentials
- If 2FA authentication is required, set this up and request code


### downloadLatestClips
- Accepts parameters
  - The number of clips to download, as a maximum
  - The timestamp to start looking at clips from, non-inclusive
- If there are new clips, downloads them to the folder


## AI API
- Google Gemini API
- Request:

```
Identify the bird species that are in the attached screenshot.  Include common name, count of the species in the screenshot, confidence level, and any other relevant information.  If there is a different animal species visible in the screenshot, identify the animal but return information indicating there is a non-bird species.  Return the result as a JSON object with the format:

{
    "hasBird": boolean,
    "species": [
        {
            "isBird": boolean,
            "commonName": "string",
            "countOfSpecies": number,
            "confidenceLevel": number
        }
    ]
}
```