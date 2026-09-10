import { Injectable, inject } from '@angular/core';
import type { GoogleGenAI } from '@google/genai';
import { ApiKeysService } from './api-keys.service';

export const IMAGE_MODEL = 'gemini-2.5-flash-image';

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
    const response = await client.models.generateContent({
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
