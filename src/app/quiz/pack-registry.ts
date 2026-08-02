import { QuestionPack } from './question.types';
import { mathsPack } from './packs/maths.pack';
import { englishPack } from './packs/english.pack';
import { frenchPack } from './packs/french.pack';
import { sciencePack } from './packs/science.pack';

export const QUESTION_PACKS: QuestionPack[] = [
  mathsPack,
  englishPack,
  frenchPack,
  sciencePack,
];

export function findPack(id: string): QuestionPack | undefined {
  return QUESTION_PACKS.find((pack) => pack.id === id);
}
