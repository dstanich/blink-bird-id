import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';

const PROMPT = "Identify the bird or birds in the attached screenshot. Return a JSON array of objects with the following format: { \"is_bird\": true or false, \"species\": \"common species name in all lower case letters\", \"gender\": \"male or female or unknown\", \"count\": number of birds of this species in the screenshot, \"confidence\": confidence score between 0 and 1, \"non_bird_species\": \"non-bird species if any\" }.  Only return JSON, do not return any other data.  If the screenshot has no bird set is_bird to false and set non_bird_species to the most prominent non-bird object in the image, if any.  Do not put the JSON in a codeblock, return only JSON.";

export class AIProvider {
    constructor() {
        this.genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    }

    async identifyBird(clipData, screenshotPath) {
        try {
            // Read the image file and convert to base64
            const imageData = fs.readFileSync(screenshotPath);
            const base64Image = imageData.toString('base64');

            const response = await this.genai.models.generateContent({
                model: process.env.GOOGLE_MODEL,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    mimeType: "image/jpeg",
                                    data: base64Image,
                                }
                            },
                            {
                                text: PROMPT,
                            }
                        ]
                    }
                ]
            })

            const resultJson = JSON.parse(response.text);
            console.log(`Identified bird for clip ${clipData.id}: ${JSON.stringify(resultJson)}`);
            resultJson.model = process.env.GOOGLE_MODEL;
            return resultJson;
        } catch(error) {
            console.error(`Error identifying bird for clip ${clipData.id}:`, error);
            throw error;
        }
    }
}
