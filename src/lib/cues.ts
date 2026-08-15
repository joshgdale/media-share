import type { CueItem, EndAction, MediaType } from '../types';

export function allowedEndActions(type: MediaType): EndAction[] {
  return type === 'video' ? ['continue', 'stop'] : ['continue', 'stop', 'freeze'];
}

export function defaultEndAction(type: MediaType): EndAction {
  return type === 'video' ? 'stop' : 'freeze';
}

export function normalizeCue(cue: CueItem): CueItem {
  if (cue.type === 'video' && cue.endAction === 'freeze') {
    return { ...cue, endAction: 'continue' };
  }
  return cue;
}

export function normalizeCues(cues: CueItem[]): CueItem[] {
  return cues.map(normalizeCue);
}
