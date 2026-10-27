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
});
