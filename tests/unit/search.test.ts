import { describe, expect, it } from 'vitest';
import { matchTab } from '../../lib/search/search';

describe('matchTab', () => {
  it('matches everything when nothing is typed, highlighting nothing', () => {
    expect(matchTab('', 'Inbox', 'https://mail.example.com')).toEqual({ before: 'Inbox', match: '', after: '' });
    expect(matchTab('   ', 'Inbox', 'https://mail.example.com')).toEqual({ before: 'Inbox', match: '', after: '' });
  });

  it('highlights the matching part of the title, ignoring case', () => {
    expect(matchTab('PLAN', 'Q4 planning', 'https://docs.example.com')).toEqual({
      before: 'Q4 ',
      match: 'plan',
      after: 'ning',
    });
  });

  it('ignores the spaces around what was typed', () => {
    expect(matchTab(' plan ', 'Running plan', 'https://x.example')?.match).toBe('plan');
  });

  it('matches the address when the title does not, highlighting nothing', () => {
    expect(matchTab('github', 'Pull request #12', 'https://github.com/x')).toEqual({
      before: 'Pull request #12',
      match: '',
      after: '',
    });
  });

  it('does not match when neither the title nor the address has it', () => {
    expect(matchTab('passport', 'Inbox', 'https://mail.example.com')).toBeNull();
  });

  it('takes what was typed literally, never as a pattern', () => {
    expect(matchTab('a.c', 'abc', 'https://x.example')).toBeNull();
    expect(matchTab('c++', 'Learn C++ today', 'https://x.example')).toEqual({
      before: 'Learn ',
      match: 'C++',
      after: ' today',
    });
    expect(matchTab('(draft', 'Plan (draft)', 'https://x.example')?.match).toBe('(draft');
  });

  it('highlights the first place it appears in the title', () => {
    expect(matchTab('ab', 'xab yab', 'https://x.example')).toEqual({ before: 'x', match: 'ab', after: ' yab' });
  });

  it('highlights the title also when the address matches too', () => {
    expect(matchTab('git', 'GitHub', 'https://github.com')?.match).toBe('Git');
  });

  it('matches the address ignoring case', () => {
    expect(matchTab('docs/plan', 'Untitled', 'https://example.com/Docs/Plan')).not.toBeNull();
  });

  it('ignores tabs and line breaks around what was typed, but not the spaces inside it', () => {
    expect(matchTab('\tq4 plan\n', 'Q4 planning', 'https://x.example')?.match).toBe('Q4 plan');
    expect(matchTab('q4  plan', 'Q4 planning', 'https://x.example')).toBeNull();
  });

  it('keeps the title whole around the match, with emoji and right to left scripts', () => {
    expect(matchTab('party', '🎉🎉 Party time', 'https://x.example')).toEqual({
      before: '🎉🎉 ',
      match: 'Party',
      after: ' time',
    });
    expect(matchTab('بالعالم', 'مرحبا بالعالم!', 'https://x.example')).toEqual({
      before: 'مرحبا ',
      match: 'بالعالم',
      after: '!',
    });
    expect(matchTab('🎉', 'a🎉b', 'https://x.example')).toEqual({ before: 'a', match: '🎉', after: 'b' });
  });
});
