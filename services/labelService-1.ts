import { GoogleGenAI, Type } from "@google/genai";
import { ScanResult } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes a captured image frame to extract warehouse label information.
 * Uses gemini-2.5-flash-image for speed and efficiency.
 */
export const analyzeLabelImage = async (base64Image: string): Promise<ScanResult> => {
  // Remove data URL prefix if present to get raw base64
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: "Analyze this shipping label. Extract the tracking number (barcode value), destination city/code, item description if visible, and determine priority based on keywords like 'Express' or 'Urgent'. Return JSON."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            barcode: { type: Type.STRING, description: "The main tracking number or barcode text" },
            destination: { type: Type.STRING, description: "City code or destination name" },
            description: { type: Type.STRING, description: "Brief description of package content" },
            priority: { type: Type.STRING, enum: ["HIGH", "NORMAL", "LOW"] }
          },
          required: ["barcode", "priority"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as ScanResult;

  } catch (error) {
    console.error("AI Scan Error:", error);
    // Fallback for demo purposes if AI fails or quota exceeded
    return {
      barcode: "ERR-SCAN-FAILED",
      destination: "UNKNOWN",
      description: "Manual check required",
      priority: "NORMAL"
    };
  }
};
