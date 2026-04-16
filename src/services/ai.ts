import { GoogleGenAI, Type, Schema } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const evaluationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    evaluations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          userAnswer: { type: Type.STRING },
          correctDefinition: { type: Type.STRING },
          isCorrect: { type: Type.BOOLEAN, description: "True if the user's answer is reasonably close to the correct definition, capturing the core meaning." },
          feedback: { type: Type.STRING, description: "Brief feedback explaining what they got right or wrong." },
          example: { type: Type.STRING, description: "A simple example sentence using the verb in context." }
        },
        required: ["word", "userAnswer", "correctDefinition", "isCorrect", "feedback", "example"]
      }
    },
    overallFeedback: { type: Type.STRING, description: "A short encouraging message summarizing their performance." }
  },
  required: ["evaluations", "overallFeedback"]
};

export interface EvaluationResult {
  evaluations: {
    word: string;
    userAnswer: string;
    correctDefinition: string;
    isCorrect: boolean;
    feedback: string;
    example: string;
  }[];
  overallFeedback: string;
}

export async function evaluateAnswers(
  answers: { word: string; userAnswer: string; correctDefinition: string }[]
): Promise<EvaluationResult> {
  const prompt = `
You are an expert English tutor evaluating a student's knowledge of specific verbs often used in academic or analytical writing.
The student was given a list of verbs and asked to provide their definitions.

Here are the student's answers along with the expected correct definitions:
${JSON.stringify(answers, null, 2)}

Evaluate each answer. Be lenient if the student captures the core meaning, even if they don't use the exact words.
Provide a simple example sentence using the verb.
Return the evaluation in the requested JSON format.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: evaluationSchema,
      temperature: 0.1,
    }
  });

  if (!response.text) {
    throw new Error("Failed to get evaluation from AI.");
  }

  return JSON.parse(response.text) as EvaluationResult;
}
