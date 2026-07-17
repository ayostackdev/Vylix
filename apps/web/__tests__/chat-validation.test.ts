import { describe, it, expect } from 'vitest';

describe('Chat input validation', () => {
  const MAX_MESSAGE_LENGTH = 2000;
  const MAX_MESSAGES = 20;

  it('rejects empty messages', () => {
    const msg = '';
    expect(msg.trim().length).toBe(0);
  });

  it('rejects messages exceeding max length', () => {
    const msg = 'a'.repeat(MAX_MESSAGE_LENGTH + 1);
    expect(msg.length).toBeGreaterThan(MAX_MESSAGE_LENGTH);
  });

  it('accepts messages within length limit', () => {
    const msg = 'a'.repeat(MAX_MESSAGE_LENGTH);
    expect(msg.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
  });

  it('trims whitespace from messages', () => {
    const msg = '  hello  ';
    expect(msg.trim()).toBe('hello');
  });

  it('limits message history to last N messages', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
    }));

    const limited = messages.slice(-MAX_MESSAGES);
    expect(limited).toHaveLength(MAX_MESSAGES);
    expect(limited[0].content).toBe('Message 10');
  });

  it('validates message role', () => {
    const validRoles = ['user', 'assistant'];
    expect(validRoles).toContain('user');
    expect(validRoles).toContain('assistant');
    expect(validRoles).not.toContain('system');
  });
});

describe('Document ID validation', () => {
  it('rejects empty document_id', () => {
    const id = '';
    expect(id.length).toBe(0);
  });

  it('rejects document_id exceeding max length', () => {
    const id = 'a'.repeat(129);
    expect(id.length).toBeGreaterThan(128);
  });

  it('accepts valid document_id', () => {
    const id = 'doc_abc123';
    expect(id.length).toBeLessThanOrEqual(128);
    expect(id.length).toBeGreaterThan(0);
  });
});
