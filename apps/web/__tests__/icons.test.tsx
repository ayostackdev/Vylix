import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import {
  SpinnerIcon,
  CloseIcon,
  LockIcon,
  CheckIcon,
  UploadIcon,
  DownloadIcon,
  PlusIcon,
  SignInIcon,
  SearchIcon,
  MenuIcon,
  WarningIcon,
} from '@/components/ui/Icons';

const iconComponents = [
  { name: 'SpinnerIcon', Component: SpinnerIcon },
  { name: 'CloseIcon', Component: CloseIcon },
  { name: 'LockIcon', Component: LockIcon },
  { name: 'CheckIcon', Component: CheckIcon },
  { name: 'UploadIcon', Component: UploadIcon },
  { name: 'DownloadIcon', Component: DownloadIcon },
  { name: 'PlusIcon', Component: PlusIcon },
  { name: 'SignInIcon', Component: SignInIcon },
  { name: 'SearchIcon', Component: SearchIcon },
  { name: 'MenuIcon', Component: MenuIcon },
  { name: 'WarningIcon', Component: WarningIcon },
];

describe('Icon components', () => {
  iconComponents.forEach(({ name, Component }) => {
    it(`${name} renders without crashing`, () => {
      const { container } = render(React.createElement(Component));
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.tagName).toBe('svg');
    });
  });

  it('applies custom size class', () => {
    const { container } = render(React.createElement(CloseIcon, { size: 'lg' }));
    const svg = container.querySelector('svg');
    expect(svg?.className.baseVal).toContain('w-6');
    expect(svg?.className.baseVal).toContain('h-6');
  });

  it('applies custom className', () => {
    const { container } = render(React.createElement(SearchIcon, { className: 'my-custom-class' }));
    const svg = container.querySelector('svg');
    expect(svg?.className.baseVal).toContain('my-custom-class');
  });
});
