import { Injectable, inject } from '@angular/core';
import type { GoogleGenAI } from '@google/genai';
import { ApiKeysService } from './api-keys.service';

/**
 * Image generation is a **paid** Gemini feature: the free tier grants zero
 * image requests, so a brand-new key returns 429 with `limit: 0` on every image
 * model until billing is enabled on the Cloud project. `explainGeminiError`
 * below turns that into something readable, because the raw response is a wall
 * of quota JSON that looks like a bug in the app.
 */
export const IMAGE_MODEL = 'gemini-3.1-flash-image';

export interface GeneratedImage {
  /** `data:image/png;base64,...` ready to hand to an <img> or the analyser. */
  dataUrl: string;
  mimeType: string;
}

@Injectable({ providedIn: 'root' })
export class GeminiImageService {
  private readonly keys = inject(ApiKeysService);

  /**
   * The GenAI SDK is a few hundred kB and is only ever needed in the media
   * studio, so it is imported on demand rather than shipped to every child who
   * just wants to play.
   */
  private async client(): Promise<GoogleGenAI> {
    const apiKey = this.keys.geminiKey().trim();
    if (!apiKey) {
      throw new Error(
        'No Gemini API key saved. Add one on the Keys tab to generate images.',
      );
    }
    const { GoogleGenAI } = await import('@google/genai');
    return new GoogleGenAI({ apiKey });
  }

  /**
   * `seed` turns this into an image-to-image edit: the model is handed a
   * picture to work from as well as words. That is how the landscape is made —
   * a sketch with the clearings already in the right places constrains the
   * result far more tightly than any amount of describing them could.
   */
  async generateImage(
    prompt: string,
    seed?: { dataUrl: string; mimeType?: string },
  ): Promise<GeneratedImage> {
    const client = await this.client();
    let response;
    try {
      response = await client.models.generateContent({
        model: IMAGE_MODEL,
        contents: seed
          ? [
              {
                inlineData: {
                  mimeType: seed.mimeType ?? mimeTypeOf(seed.dataUrl),
                  data: base64Of(seed.dataUrl),
                },
              },
              { text: prompt },
            ]
          : prompt,
      });
    } catch (error) {
      throw new Error(explainGeminiError(error));
    }

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) {
        const mimeType = part.inlineData?.mimeType ?? 'image/png';
        return { dataUrl: `data:${mimeType};base64,${data}`, mimeType };
      }
    }

    // A refusal or safety block comes back as text rather than an image;
    // surfacing it is far more useful than "no image returned".
    const text = parts
      .map((part) => part.text)
      .filter(Boolean)
      .join(' ')
      .trim();
    throw new Error(
      text
        ? `The image model replied with text instead of an image: ${text}`
        : 'The image model returned no image. Try rewording the prompt.',
    );
  }
}

/** `data:image/png;base64,AAA` → `AAA`. */
function base64Of(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('That does not look like a data: URI.');
  return dataUrl.slice(comma + 1);
}

function mimeTypeOf(dataUrl: string): string {
  return dataUrl.match(/^data:([^;,]+)/)?.[1] ?? 'image/png';
}

/**
 * Turns a Gemini failure into something a person can act on.
 *
 * The one that matters is the quota error. Image generation has **no free
 * tier**, so an otherwise perfectly good key returns 429 with `limit: 0` on
 * every image model, wrapped in several hundred characters of quota JSON. Shown
 * raw, that reads like the app is broken rather than like an account that needs
 * billing switched on.
 */
export function explainGeminiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/RESOURCE_EXHAUSTED|\b429\b/.test(message)) {
    // `limit: 0` means none was ever granted, which is a different problem from
    // having used up an allowance that will come back.
    if (/limit:\s*0\b/.test(message)) {
      return (
        'Google gives no free quota for image generation, so this key cannot ' +
        'make images yet. Enable billing on the Google Cloud project behind ' +
        'the key (console.cloud.google.com → Billing), then try again. ' +
        'Nothing else in the studio needs it.'
      );
    }
    const retry = message.match(/retry in ([\d.]+)s/i)?.[1];
    return retry
      ? `Too many requests just now — Google asked to wait ${Math.ceil(Number(retry))} seconds. Try again shortly.`
      : 'Too many requests just now. Wait a moment and try again.';
  }

  if (/API_KEY_INVALID|API key not valid/i.test(message)) {
    return 'That Gemini API key was not accepted. Check it on the Keys tab.';
  }

  if (/PERMISSION_DENIED|SERVICE_DISABLED/i.test(message)) {
    return (
      'This key is not allowed to use the image model. Check that the ' +
      'Generative Language API is enabled for its project.'
    );
  }

  if (/\bNOT_FOUND\b|is not found|no longer available/i.test(message)) {
    return `The image model ${IMAGE_MODEL} was not available to this key. It may have been retired — check the model name in gemini-image.service.ts.`;
  }

  return message;
}
