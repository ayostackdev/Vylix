import { describe, expect, it } from 'vitest';

import {
  documentChatCacheKey,
  estimatedJsonBytes,
  hashText,
  studyAgentCacheKey,
} from '@/lib/qa-cache';

describe('qa-cache key derivation', () => {
  it('hashes deterministically', () => {
    expect(hashText('what is the capital of Nigeria?')).toBe(
      hashText('what is the capital of Nigeria?'),
    );
  });

  it('produces different hashes for different text', () => {
    expect(hashText('question one')).not.toBe(hashText('question two'));
  });

  it('scopes study keys by course, tier and prompt content', () => {
    const prompt = 'Build a study plan for STA401';
    const a = studyAgentCacheKey('STA401', prompt, 'standard');
    const b = studyAgentCacheKey('STA401', prompt, 'standard');
    const otherPrompt = studyAgentCacheKey('STA401', 'Different question', 'standard');
    const otherTier = studyAgentCacheKey('STA401', prompt, 'complex');
    const otherCourse = studyAgentCacheKey('MTH301', prompt, 'standard');

    expect(a).toBe(b);
    expect(a).not.toBe(otherPrompt);
    expect(a).not.toBe(otherTier);
    expect(a).not.toBe(otherCourse);
    expect(a).toContain('qa:study:STA401:standard:');
  });

  it('scopes document-chat keys by document and query', () => {
    const doc = 'material-uuid';
    const query = 'derive Bayes rule';
    const a = documentChatCacheKey(doc, query);
    const b = documentChatCacheKey(doc, query);
    const otherDoc = documentChatCacheKey('other-material', query);
    const otherQuery = documentChatCacheKey(doc, 'different query');

    expect(a).toBe(b);
    expect(a).not.toBe(otherDoc);
    expect(a).not.toBe(otherQuery);
    expect(a).toContain(`qa:chat:${doc}:`);
  });
});

describe('estimatedJsonBytes', () => {
  it('matches the serialized payload length', () => {
    const payload = { answer: 'hello', follow_up_questions: ['a', 'b'] };
    expect(estimatedJsonBytes(payload)).toBe(JSON.stringify(payload).length);
  });

  it('handles circular/unsafe values gracefully', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(estimatedJsonBytes(circular)).toBe(0);
  });
});
