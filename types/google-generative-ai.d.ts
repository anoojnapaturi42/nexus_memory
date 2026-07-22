declare module "@google/generative-ai" {
  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(config: {
      model: string;
      generationConfig?: Record<string, unknown>;
    }): {
      generateContent(prompt: string): Promise<any>;
      generateContentStream(prompt: string): Promise<any>;
      embedContent(text: string): Promise<any>;
    };
  }
}
