import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';

export const DEFAULT_PROMPT = "Identify the bird or birds in the attached screenshot. Return a JSON array of objects with the following format: { \"is_bird\": true or false, \"species\": \"common species name in all lower case letters\", \"gender\": \"male or female or unknown\", \"count\": number of birds of this species in the screenshot, \"confidence\": confidence score between 0 and 1, \"non_bird_species\": \"non-bird species if any\" }.  Only return JSON, do not return any other data.  If the screenshot has no bird set is_bird to false and set non_bird_species to the most prominent non-bird object in the image, if any.  If there is no bird, still calculate the confidence score between 0 and 1 for what you believe is in the image.  Do not put the JSON in a codeblock, return only JSON.";
export const DEFAULT_MODEL = "gemini-2.5-flash";

export class AIProvider {
    constructor(storage) {
        this.storage = storage;
        this.genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    }

    async identifyBird(clipData, screenshotPath) {
        try {
            const promptSetting = this.storage.getSettingWithId('ai_prompt');
            const modelSetting = this.storage.getSettingWithId('ai_model');
            const prompt = promptSetting?.value || DEFAULT_PROMPT;
            const model = modelSetting?.value || DEFAULT_MODEL;

            // Read the image file and convert to base64
            const imageData = fs.readFileSync(screenshotPath);
            const base64Image = imageData.toString('base64');

            const response = await this.genai.models.generateContent({
                model,
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
                                text: prompt,
                            }
                        ]
                    }
                ]
            })

            const resultJson = JSON.parse(response.text);
            const resultArray = Array.isArray(resultJson) ? resultJson : [resultJson]; // supposed to be an array but it isn't always
            for (const result of resultArray) {
                result.ai_model_id = modelSetting?.id ?? null;
                result.ai_prompt_id = promptSetting?.id ?? null;
            }
            console.log(`Identified bird for clip ${clipData.id}: ${JSON.stringify(resultArray)}`);
            return Array.isArray(resultJson) ? resultArray : resultArray[0];
        } catch(error) {
            console.error(`Error identifying bird for clip ${clipData.id}:`, error);
            throw error;
        }
    }
}
