import { GoogleGenAI, Type, Schema } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MAX_ATTEMPTS = 3;

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

function isEvaluationResult(value: unknown): value is EvaluationResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EvaluationResult>;
  return Array.isArray(candidate.evaluations) && typeof candidate.overallFeedback === 'string';
}

function parseEvaluationResponse(text: string): EvaluationResult {
  const trimmed = text.trim();

  try {
    const direct = JSON.parse(trimmed) as unknown;
    if (isEvaluationResult(direct)) return direct;
  } catch {}

  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (blockMatch?.[1]) {
    const fromBlock = JSON.parse(blockMatch[1]) as unknown;
    if (isEvaluationResult(fromBlock)) return fromBlock;
  }

  throw new Error('AI response was not in the expected format.');
}

function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return [
    'timeout',
    'timed out',
    'network',
    'fetch',
    '503',
    '500',
    '429',
    'unavailable',
    'overloaded',
    'temporarily'
  ].some(fragment => message.includes(fragment));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: evaluationSchema,
          temperature: 0.1,
        }
      });

      if (!response.text || !response.text.trim()) {
        throw new Error('Empty response from AI.');
      }

      const parsed = parseEvaluationResponse(response.text);
      if (!parsed.evaluations.length) {
        throw new Error('No evaluation items were returned by AI.');
      }

      return parsed;
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS || !isRetryableError(err)) {
        break;
      }
      await sleep(300 * attempt);
    }
  }

  const detail = lastError instanceof Error ? lastError.message : 'Unknown error';
  throw new Error(`Evaluation failed after ${MAX_ATTEMPTS} attempts: ${detail}`);
}
